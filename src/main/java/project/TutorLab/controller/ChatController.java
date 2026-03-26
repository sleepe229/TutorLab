package project.TutorLab.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.config.JwtService;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.ChatService;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chats")
public class ChatController {

    @Autowired
    private ChatService chatService;

    @Autowired
    private TutorRepository tutorRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // ── Auth helpers ──────────────────────────────────────────────────────────

    /** Returns caller's id (tutorId or studentAccountId), or null if unauthenticated. */
    private String resolveCallerId(HttpServletRequest request) {
        String tutorId = (String) request.getAttribute("tutorId");
        if (tutorId != null) return tutorId;
        String sessionToken = request.getHeader("X-Session-Token");
        if (sessionToken != null && jwtService.isTokenValid(sessionToken)
                && "TUTOR".equals(jwtService.extractRole(sessionToken))) {
            return jwtService.extractTutorId(sessionToken);
        }
        String studentToken = request.getHeader("X-Student-Token");
        if (studentToken != null && jwtService.isStudentToken(studentToken)) {
            return jwtService.extractTutorId(studentToken);
        }
        return null;
    }

    /** Returns "TUTOR" or "STUDENT" based on which token is present. */
    private String resolveCallerRole(HttpServletRequest request) {
        String tutorId = (String) request.getAttribute("tutorId");
        if (tutorId != null) return "TUTOR";
        String sessionToken = request.getHeader("X-Session-Token");
        if (sessionToken != null && jwtService.isTokenValid(sessionToken)
                && "TUTOR".equals(jwtService.extractRole(sessionToken))) {
            return "TUTOR";
        }
        return "STUDENT";
    }

    // ── DIRECT chat ───────────────────────────────────────────────────────────

    @PostMapping(path = {"", "/"})
    public ResponseEntity<Chat> getOrCreateChat(@RequestBody Map<String, String> body,
                                                HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        String tutorId = body.get("tutorId");
        String studentAccountId = body.get("studentAccountId");
        String studentName = body.get("studentName");

        if (tutorId == null || studentAccountId == null) {
            return ResponseEntity.badRequest().build();
        }

        String tutorName = "";
        Tutor tutor = tutorRepository.findById(tutorId);
        if (tutor != null) tutorName = tutor.getFullName() != null ? tutor.getFullName() : "";
        if (studentName == null) studentName = "";

        Chat chat = chatService.getOrCreateChat(tutorId, studentAccountId, studentName, tutorName);
        return ResponseEntity.ok(chat);
    }

    @GetMapping("/tutor/{tutorId}")
    public ResponseEntity<List<Chat>> getChatsForTutor(@PathVariable String tutorId,
                                                       HttpServletRequest request) {
        String authenticatedTutorId = resolveCallerId(request);
        if (!tutorId.equals(authenticatedTutorId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(chatService.getChatsForTutor(tutorId));
    }

    @GetMapping("/student/{studentAccountId}")
    public ResponseEntity<List<Chat>> getChatsForStudent(
            @PathVariable String studentAccountId,
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader) {
        if (tokenHeader == null || !jwtService.isStudentToken(tokenHeader)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String tokenSubject = jwtService.extractTutorId(tokenHeader);
        if (!studentAccountId.equals(tokenSubject)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(chatService.getChatsForStudent(studentAccountId));
    }

    @GetMapping("/{chatId}/messages")
    public ResponseEntity<List<ChatMessage>> getMessages(@PathVariable String chatId,
                                                         HttpServletRequest request) {
        if (resolveCallerId(request) == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(chatService.getMessages(chatId));
    }

    @PostMapping("/{chatId}/message")
    public ResponseEntity<ChatMessage> sendMessage(
            @PathVariable String chatId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        String senderRole = body.get("senderRole");
        String senderName = body.get("senderName");
        String text = body.get("text");
        String type = body.get("type");
        String inviteStudentId = body.get("inviteStudentId");
        String fileUrl = body.get("fileUrl");
        String fileName = body.get("fileName");

        if (senderRole == null || text == null) return ResponseEntity.badRequest().build();

        ChatMessage message = chatService.sendMessage(chatId, callerId, senderRole, senderName,
                text, type, inviteStudentId, fileUrl, fileName);
        messagingTemplate.convertAndSend("/topic/chat." + chatId, message);
        return ResponseEntity.ok(message);
    }

    @PostMapping("/{chatId}/read/tutor")
    public ResponseEntity<Void> markReadByTutor(@PathVariable String chatId,
                                                HttpServletRequest request) {
        if (resolveCallerId(request) == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        chatService.markReadByTutor(chatId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{chatId}/read/student")
    public ResponseEntity<Void> markReadByStudent(
            @PathVariable String chatId,
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader) {
        if (tokenHeader == null || !jwtService.isStudentToken(tokenHeader)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        chatService.markReadByStudent(chatId);
        return ResponseEntity.ok().build();
    }

    // ── Message edit / delete ─────────────────────────────────────────────────

    @PutMapping("/{chatId}/messages/{messageId}")
    public ResponseEntity<ChatMessage> editMessage(
            @PathVariable String chatId,
            @PathVariable String messageId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String newText = body.get("text");
        if (newText == null || newText.isBlank()) return ResponseEntity.badRequest().build();
        ChatMessage updated = chatService.editMessage(chatId, messageId, newText.trim(), callerId);
        Map<String, Object> event = Map.of("type", "MESSAGE_EDITED", "message", updated);
        messagingTemplate.convertAndSend("/topic/chat." + chatId, event);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{chatId}/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable String chatId,
            @PathVariable String messageId,
            HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        ChatMessage deleted = chatService.deleteMessage(chatId, messageId, callerId);
        Map<String, Object> event = Map.of("type", "MESSAGE_DELETED", "messageId", messageId);
        messagingTemplate.convertAndSend("/topic/chat." + chatId, event);
        return ResponseEntity.noContent().build();
    }

    // ── Group chats ───────────────────────────────────────────────────────────

    @PostMapping("/groups")
    public ResponseEntity<Chat> createGroup(@RequestBody Map<String, Object> body,
                                            HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String callerRole = resolveCallerRole(request);

        String groupName = (String) body.get("groupName");
        @SuppressWarnings("unchecked")
        List<String> participantIds = (List<String>) body.getOrDefault("participantIds", new ArrayList<>());
        String creatorName = (String) body.getOrDefault("creatorName", "");

        if (groupName == null || groupName.isBlank()) return ResponseEntity.badRequest().build();

        Chat group = chatService.createGroup(groupName.trim(), participantIds,
                callerId, callerRole, creatorName);
        return ResponseEntity.status(HttpStatus.CREATED).body(group);
    }

    @GetMapping("/groups/participant/{participantId}")
    public ResponseEntity<List<Chat>> getGroupsForParticipant(
            @PathVariable String participantId, HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(chatService.getGroupsForParticipant(participantId));
    }

    @PostMapping("/groups/{chatId}/members")
    public ResponseEntity<Chat> addGroupMember(
            @PathVariable String chatId,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String participantId = body.get("participantId");
        if (participantId == null) return ResponseEntity.badRequest().build();
        Chat updated = chatService.addGroupMember(chatId, participantId, callerId);
        Map<String, Object> event = Map.of("type", "MEMBER_ADDED", "participantId", participantId);
        messagingTemplate.convertAndSend("/topic/chat." + chatId, event);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/groups/{chatId}/members/{participantId}")
    public ResponseEntity<Chat> removeGroupMember(
            @PathVariable String chatId,
            @PathVariable String participantId,
            HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Chat updated = chatService.removeGroupMember(chatId, participantId, callerId);
        Map<String, Object> event = Map.of("type", "MEMBER_REMOVED", "participantId", participantId);
        messagingTemplate.convertAndSend("/topic/chat." + chatId, event);
        return ResponseEntity.ok(updated);
    }

    // ── 1v1 moderation ────────────────────────────────────────────────────────

    @PostMapping("/{chatId}/block")
    public ResponseEntity<Chat> blockChat(@PathVariable String chatId,
                                          HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String callerRole = resolveCallerRole(request);
        Chat updated = chatService.blockChat(chatId, callerId, callerRole);
        Map<String, Object> event = Map.of("type", "CHAT_BLOCKED", "blockedBy", callerRole);
        messagingTemplate.convertAndSend("/topic/chat." + chatId, event);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{chatId}/unblock")
    public ResponseEntity<Chat> unblockChat(@PathVariable String chatId,
                                            HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String callerRole = resolveCallerRole(request);
        Chat updated = chatService.unblockChat(chatId, callerId, callerRole);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{chatId}/hide")
    public ResponseEntity<Chat> hideChat(@PathVariable String chatId,
                                         HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String callerRole = resolveCallerRole(request);
        Chat updated = chatService.hideChat(chatId, callerId, callerRole);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{chatId}/unhide")
    public ResponseEntity<Chat> unhideChat(@PathVariable String chatId,
                                           HttpServletRequest request) {
        String callerId = resolveCallerId(request);
        if (callerId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String callerRole = resolveCallerRole(request);
        Chat updated = chatService.unhideChat(chatId, callerId, callerRole);
        return ResponseEntity.ok(updated);
    }
}
