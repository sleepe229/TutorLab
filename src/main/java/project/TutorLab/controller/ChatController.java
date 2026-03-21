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

    /** Resolve caller identity from either tutor or student token. Returns null if unauthenticated. */
    private String resolveCallerId(HttpServletRequest request) {
        // Tutor path: AuthInterceptor already validated X-Session-Token and put tutorId in attribute
        String tutorId = (String) request.getAttribute("tutorId");
        if (tutorId != null) return tutorId;
        // Tutor JWT in header (interceptor skipped for /api/chats/**)
        String sessionToken = request.getHeader("X-Session-Token");
        if (sessionToken != null && jwtService.isTokenValid(sessionToken)
                && "TUTOR".equals(jwtService.extractRole(sessionToken))) {
            return jwtService.extractTutorId(sessionToken);
        }
        // Student path: validate X-Student-Token directly
        String studentToken = request.getHeader("X-Student-Token");
        if (studentToken != null && jwtService.isStudentToken(studentToken)) {
            return jwtService.extractTutorId(studentToken); // subject extraction is role-agnostic
        }
        return null;
    }

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
        if (tutor != null) {
            tutorName = tutor.getFullName() != null ? tutor.getFullName() : "";
        }
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

        if (senderRole == null || text == null) {
            return ResponseEntity.badRequest().build();
        }

        // Use verified caller identity, not client-provided senderId
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
}
