package project.TutorLab.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import project.TutorLab.dto.TutorRegistrationDto;
import project.TutorLab.dto.TutorResponseDto;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;
import project.TutorLab.service.AuthRateLimiter;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class ChatControllerIntegrationTest {

    @MockBean
    AuthRateLimiter authRateLimiter;

    @Container
    @SuppressWarnings("resource")
    static GenericContainer<?> redis =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    @Container
    @SuppressWarnings("resource")
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("tutorlab")
                    .withUsername("tutorlab")
                    .withPassword("tutorlab");

    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    private TutorResponseDto registerTutor() {
        TutorRegistrationDto dto = new TutorRegistrationDto();
        dto.setFullName("Chat Tester");
        dto.setLogin("chat_it_" + System.currentTimeMillis());
        dto.setPassword("password123");
        ResponseEntity<TutorResponseDto> resp =
                restTemplate.postForEntity("/api/tutors/register", dto, TutorResponseDto.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode());
        return resp.getBody();
    }

    private HttpHeaders tutorHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-Session-Token", token);
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }

    /** Creates a direct chat between a tutor and a student account ID. */
    private Chat createDirectChat(String tutorId, String tutorToken, String studentAccountId) {
        Map<String, String> body = Map.of(
                "tutorId", tutorId,
                "studentAccountId", studentAccountId,
                "studentName", "Test Student"
        );
        HttpEntity<Map<String, String>> req = new HttpEntity<>(body, tutorHeaders(tutorToken));
        ResponseEntity<Chat> resp = restTemplate.exchange("/api/chats", HttpMethod.POST, req, Chat.class);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        return resp.getBody();
    }

    // ── getOrCreateChat ───────────────────────────────────────────────────────

    @Test
    void getOrCreateChat_newChat_returnsOkWithChatId() {
        TutorResponseDto tutor = registerTutor();
        String studentAccountId = "student-account-" + System.currentTimeMillis();

        Chat chat = createDirectChat(tutor.getId(), tutor.getSessionToken(), studentAccountId);

        assertNotNull(chat);
        assertNotNull(chat.getId());
        assertEquals(tutor.getId(), chat.getTutorId());
        assertEquals(studentAccountId, chat.getStudentAccountId());
    }

    @Test
    void getOrCreateChat_sameParticipants_returnsExistingChat() {
        TutorResponseDto tutor = registerTutor();
        String studentAccountId = "student-account-" + System.currentTimeMillis();

        Chat first = createDirectChat(tutor.getId(), tutor.getSessionToken(), studentAccountId);
        Chat second = createDirectChat(tutor.getId(), tutor.getSessionToken(), studentAccountId);

        // Should return the same chat
        assertEquals(first.getId(), second.getId());
    }

    @Test
    void getOrCreateChat_noAuth_returns401() {
        Map<String, String> body = Map.of(
                "tutorId", "t1", "studentAccountId", "sa1"
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, String>> req = new HttpEntity<>(body, headers);
        ResponseEntity<Void> resp = restTemplate.exchange("/api/chats", HttpMethod.POST, req, Void.class);
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    // ── sendMessage ───────────────────────────────────────────────────────────

    @Test
    void sendMessage_returns200WithMessage() {
        TutorResponseDto tutor = registerTutor();
        String studentAccountId = "student-" + System.currentTimeMillis();
        Chat chat = createDirectChat(tutor.getId(), tutor.getSessionToken(), studentAccountId);

        Map<String, String> msgBody = Map.of(
                "senderRole", "TUTOR",
                "senderName", "Chat Tester",
                "text", "Привет, как дела?"
        );
        HttpEntity<Map<String, String>> req = new HttpEntity<>(msgBody, tutorHeaders(tutor.getSessionToken()));
        ResponseEntity<ChatMessage> resp = restTemplate.exchange(
                "/api/chats/" + chat.getId() + "/message",
                HttpMethod.POST, req, ChatMessage.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertNotNull(resp.getBody().getId());
        // Text should be returned decrypted (plaintext)
        assertEquals("Привет, как дела?", resp.getBody().getText());
    }

    // ── getMessages ───────────────────────────────────────────────────────────

    @Test
    void getMessages_returnsMessageList() {
        TutorResponseDto tutor = registerTutor();
        String studentAccountId = "student-" + System.currentTimeMillis();
        Chat chat = createDirectChat(tutor.getId(), tutor.getSessionToken(), studentAccountId);

        // Send a message
        Map<String, String> msgBody = Map.of("senderRole", "TUTOR", "senderName", "Tutor",
                "text", "Тестовое сообщение");
        restTemplate.exchange("/api/chats/" + chat.getId() + "/message",
                HttpMethod.POST, new HttpEntity<>(msgBody, tutorHeaders(tutor.getSessionToken())), ChatMessage.class);

        // Get messages
        ResponseEntity<List> resp = restTemplate.exchange(
                "/api/chats/" + chat.getId() + "/messages",
                HttpMethod.GET, new HttpEntity<>(tutorHeaders(tutor.getSessionToken())), List.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertFalse(resp.getBody().isEmpty());
    }

    // ── editMessage ───────────────────────────────────────────────────────────

    @Test
    void editMessage_ownerEdits_returns200WithNewText() {
        TutorResponseDto tutor = registerTutor();
        String studentAccountId = "student-" + System.currentTimeMillis();
        Chat chat = createDirectChat(tutor.getId(), tutor.getSessionToken(), studentAccountId);

        Map<String, String> msgBody = Map.of("senderRole", "TUTOR", "senderName", "Tutor",
                "text", "Первоначальный текст");
        ChatMessage sent = restTemplate.exchange("/api/chats/" + chat.getId() + "/message",
                HttpMethod.POST, new HttpEntity<>(msgBody, tutorHeaders(tutor.getSessionToken())), ChatMessage.class).getBody();

        assertNotNull(sent);

        Map<String, String> editBody = Map.of("text", "Исправленный текст");
        ResponseEntity<ChatMessage> editResp = restTemplate.exchange(
                "/api/chats/" + chat.getId() + "/messages/" + sent.getId(),
                HttpMethod.PUT, new HttpEntity<>(editBody, tutorHeaders(tutor.getSessionToken())), ChatMessage.class);

        assertEquals(HttpStatus.OK, editResp.getStatusCode());
        assertEquals("Исправленный текст", editResp.getBody().getText());
    }

    // ── deleteMessage ─────────────────────────────────────────────────────────

    @Test
    void deleteMessage_returns204() {
        TutorResponseDto tutor = registerTutor();
        String studentAccountId = "student-" + System.currentTimeMillis();
        Chat chat = createDirectChat(tutor.getId(), tutor.getSessionToken(), studentAccountId);

        Map<String, String> msgBody = Map.of("senderRole", "TUTOR", "senderName", "Tutor",
                "text", "Удаляемое сообщение");
        ChatMessage sent = restTemplate.exchange("/api/chats/" + chat.getId() + "/message",
                HttpMethod.POST, new HttpEntity<>(msgBody, tutorHeaders(tutor.getSessionToken())), ChatMessage.class).getBody();

        assertNotNull(sent);

        ResponseEntity<Void> deleteResp = restTemplate.exchange(
                "/api/chats/" + chat.getId() + "/messages/" + sent.getId(),
                HttpMethod.DELETE, new HttpEntity<>(tutorHeaders(tutor.getSessionToken())), Void.class);

        assertEquals(HttpStatus.NO_CONTENT, deleteResp.getStatusCode());
    }

    // ── getChatsForTutor ──────────────────────────────────────────────────────

    @Test
    void getChatsForTutor_returnsCreatedChats() {
        TutorResponseDto tutor = registerTutor();
        createDirectChat(tutor.getId(), tutor.getSessionToken(), "sa-" + System.currentTimeMillis());

        ResponseEntity<List> resp = restTemplate.exchange(
                "/api/chats/tutor/" + tutor.getId(),
                HttpMethod.GET, new HttpEntity<>(tutorHeaders(tutor.getSessionToken())), List.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertFalse(resp.getBody().isEmpty());
    }

    // ── createGroup ───────────────────────────────────────────────────────────

    @Test
    void createGroup_returns201WithGroupId() {
        TutorResponseDto tutor = registerTutor();
        Map<String, Object> body = Map.of(
                "groupName", "Тестовая группа",
                "participantIds", List.of(tutor.getId(), "participant-1"),
                "creatorName", "Chat Tester"
        );
        HttpEntity<Map<String, Object>> req = new HttpEntity<>(body, tutorHeaders(tutor.getSessionToken()));
        ResponseEntity<Chat> resp = restTemplate.exchange("/api/chats/groups",
                HttpMethod.POST, req, Chat.class);

        assertEquals(HttpStatus.CREATED, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertNotNull(resp.getBody().getId());
        assertTrue(resp.getBody().isGroup());
        assertEquals("Тестовая группа", resp.getBody().getGroupName());
    }
}
