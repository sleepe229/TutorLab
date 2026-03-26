package project.TutorLab.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import project.TutorLab.service.AuthRateLimiter;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class StudentAuthControllerIntegrationTest {

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

    private String uniqueEmail() {
        return "student_" + System.currentTimeMillis() + "@test.com";
    }

    private Map<String, Object> registerAndGetResponse(String email) {
        Map<String, String> body = Map.of(
                "email", email,
                "password", "password123",
                "firstName", "Тест",
                "lastName", "Пользователь"
        );
        @SuppressWarnings("unchecked")
        Map<String, Object> result = restTemplate
                .postForEntity("/api/students/auth/register", body, Map.class)
                .getBody();
        return result;
    }

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    void register_validData_returns201WithTokens() {
        Map<String, String> body = Map.of(
                "email", uniqueEmail(),
                "password", "securePass123",
                "firstName", "Мария",
                "lastName", "Иванова"
        );

        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/register", body, Map.class);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertNotNull(response.getBody().get("accessToken"));
        assertNotNull(response.getBody().get("refreshToken"));
        assertNotNull(response.getBody().get("studentAccountId"));
        assertEquals("Мария", response.getBody().get("firstName"));
    }

    @Test
    void register_missingFirstName_returns400() {
        Map<String, String> body = Map.of(
                "email", uniqueEmail(),
                "password", "securePass123"
        );

        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/register", body, Map.class);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    void register_shortPassword_returns400() {
        Map<String, String> body = Map.of(
                "email", uniqueEmail(),
                "password", "short",
                "firstName", "А"
        );

        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/register", body, Map.class);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    void register_duplicateEmail_returns400() {
        String email = uniqueEmail();
        registerAndGetResponse(email); // first registration

        Map<String, String> body2 = Map.of(
                "email", email,
                "password", "anotherPass123",
                "firstName", "Другой"
        );

        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/register", body2, Map.class);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody().get("error"));
    }

    // ── login ─────────────────────────────────────────────────────────────────

    @Test
    void login_validCredentials_returns200WithJwt() {
        String email = uniqueEmail();
        registerAndGetResponse(email);

        Map<String, String> loginBody = Map.of("email", email, "password", "password123");
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/login", loginBody, Map.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        String token = (String) response.getBody().get("accessToken");
        assertNotNull(token);
        // JWT has 3 parts
        assertEquals(3, token.split("\\.").length);
    }

    @Test
    void login_wrongPassword_returns401() {
        String email = uniqueEmail();
        registerAndGetResponse(email);

        Map<String, String> loginBody = Map.of("email", email, "password", "wrongPass");
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/login", loginBody, Map.class);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void login_unknownEmail_returns401() {
        Map<String, String> loginBody = Map.of(
                "email", "nobody_" + System.currentTimeMillis() + "@test.com",
                "password", "anyPassword");
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/login", loginBody, Map.class);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    // ── refresh ───────────────────────────────────────────────────────────────

    @Test
    void refresh_validToken_returns200WithNewTokenPair() {
        String email = uniqueEmail();
        Map<String, Object> reg = registerAndGetResponse(email);
        String refreshToken = (String) reg.get("refreshToken");
        assertNotNull(refreshToken);

        Map<String, String> refreshBody = Map.of("refreshToken", refreshToken);
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/refresh", refreshBody, Map.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody().get("accessToken"));
        assertNotNull(response.getBody().get("refreshToken"));
        // Token should be rotated
        assertNotEquals(refreshToken, response.getBody().get("refreshToken"));
    }

    @Test
    void refresh_invalidToken_returns401() {
        Map<String, String> body = Map.of("refreshToken", "totally-invalid-token");
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/refresh", body, Map.class);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void refresh_reusedToken_returns401() {
        String email = uniqueEmail();
        Map<String, Object> reg = registerAndGetResponse(email);
        String refreshToken = (String) reg.get("refreshToken");

        // Use it once
        Map<String, String> body = Map.of("refreshToken", refreshToken);
        restTemplate.postForEntity("/api/students/auth/refresh", body, Map.class);

        // Use it again — should fail (token rotation)
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/students/auth/refresh", body, Map.class);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    // ── logout ────────────────────────────────────────────────────────────────

    @Test
    void logout_returns204() {
        String email = uniqueEmail();
        Map<String, Object> reg = registerAndGetResponse(email);
        String refreshToken = (String) reg.get("refreshToken");

        Map<String, String> logoutBody = Map.of("refreshToken", refreshToken);
        ResponseEntity<Void> response =
                restTemplate.postForEntity("/api/students/auth/logout", logoutBody, Void.class);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());

        // After logout the refresh token must be invalid
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> refreshAttempt =
                restTemplate.postForEntity("/api/students/auth/refresh",
                        Map.of("refreshToken", refreshToken), Map.class);
        assertEquals(HttpStatus.UNAUTHORIZED, refreshAttempt.getStatusCode());
    }

    // ── /me (GET) ─────────────────────────────────────────────────────────────

    @Test
    void getMe_withValidToken_returnsAccountInfo() {
        String email = uniqueEmail();
        Map<String, Object> reg = registerAndGetResponse(email);
        String accessToken = (String) reg.get("accessToken");

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Student-Token", accessToken);
        HttpEntity<Void> req = new HttpEntity<>(headers);

        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response =
                restTemplate.exchange("/api/students/auth/me", HttpMethod.GET, req, Map.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(email, response.getBody().get("email"));
        assertEquals("Тест", response.getBody().get("firstName"));
    }

    @Test
    void getMe_withoutToken_returns401() {
        @SuppressWarnings("unchecked")
        ResponseEntity<Map> response = restTemplate.getForEntity("/api/students/auth/me", Map.class);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }
}
