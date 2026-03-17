package project.TutorLab.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.config.JwtService;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.ChatService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chats")
@CrossOrigin(origins = "*")
public class ChatController {

    @Autowired
    private ChatService chatService;

    @Autowired
    private TutorRepository tutorRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @PostMapping
    public ResponseEntity<Chat> getOrCreateChat(@RequestBody Map<String, String> request) {
        String tutorId = request.get("tutorId");
        String studentAccountId = request.get("studentAccountId");
        String studentName = request.get("studentName");

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
    public ResponseEntity<List<Chat>> getChatsForTutor(@PathVariable String tutorId) {
        return ResponseEntity.ok(chatService.getChatsForTutor(tutorId));
    }

    @GetMapping("/student/{studentAccountId}")
    public ResponseEntity<List<Chat>> getChatsForStudent(
            @PathVariable String studentAccountId,
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader) {
        if (tokenHeader == null || !jwtService.isTokenValid(tokenHeader)) {
            return ResponseEntity.status(401).build();
        }
        String tokenSubject = jwtService.extractTutorId(tokenHeader);
        if (!studentAccountId.equals(tokenSubject)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(chatService.getChatsForStudent(studentAccountId));
    }

    @GetMapping("/{chatId}/messages")
    public ResponseEntity<List<ChatMessage>> getMessages(@PathVariable String chatId) {
        return ResponseEntity.ok(chatService.getMessages(chatId));
    }

    @PostMapping("/{chatId}/message")
    public ResponseEntity<ChatMessage> sendMessage(
            @PathVariable String chatId,
            @RequestBody Map<String, String> request) {
        String senderId = request.get("senderId");
        String senderRole = request.get("senderRole");
        String senderName = request.get("senderName");
        String text = request.get("text");
        String type = request.get("type");
        String inviteStudentId = request.get("inviteStudentId");

        if (senderId == null || senderRole == null || text == null) {
            return ResponseEntity.badRequest().build();
        }

        ChatMessage message = chatService.sendMessage(chatId, senderId, senderRole, senderName,
                text, type, inviteStudentId);
        messagingTemplate.convertAndSend("/topic/chat." + chatId, message);
        return ResponseEntity.ok(message);
    }

    @PostMapping("/{chatId}/read/tutor")
    public ResponseEntity<Void> markReadByTutor(@PathVariable String chatId) {
        chatService.markReadByTutor(chatId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{chatId}/read/student")
    public ResponseEntity<Void> markReadByStudent(@PathVariable String chatId) {
        chatService.markReadByStudent(chatId);
        return ResponseEntity.ok().build();
    }
}
