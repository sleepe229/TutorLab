package project.TutorLab.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import project.TutorLab.dto.TutorLoginDto;
import project.TutorLab.dto.TutorRegistrationDto;
import project.TutorLab.dto.TutorResponseDto;
import project.TutorLab.service.AuthRateLimiter;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class TutorControllerIntegrationTest {

    // Bypass rate limiting in integration tests — tests make multiple register/login
    // calls from the same IP, which would otherwise hit the 3-per-5min limit.
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

    @Test
    void register_newUser_returns200WithTokens() {
        TutorRegistrationDto dto = new TutorRegistrationDto();
        dto.setFullName("Integration Test User");
        dto.setLogin("inttest_" + System.currentTimeMillis());
        dto.setPassword("securePass123");

        ResponseEntity<TutorResponseDto> response =
                restTemplate.postForEntity("/api/tutors/register", dto, TutorResponseDto.class);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertNotNull(response.getBody().getId());
        assertNotNull(response.getBody().getSessionToken()); // JWT access token
        assertNotNull(response.getBody().getRefreshToken());
        assertEquals("Integration Test User", response.getBody().getFullName());
    }

    @Test
    void register_duplicateLogin_returns409() {
        String login = "duplicate_" + System.currentTimeMillis();
        TutorRegistrationDto dto = new TutorRegistrationDto();
        dto.setFullName("First User");
        dto.setLogin(login);
        dto.setPassword("password123");

        restTemplate.postForEntity("/api/tutors/register", dto, TutorResponseDto.class);

        TutorRegistrationDto dto2 = new TutorRegistrationDto();
        dto2.setFullName("Second User");
        dto2.setLogin(login);
        dto2.setPassword("password456");

        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/tutors/register", dto2, Map.class);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
    }

    @Test
    void login_correctCredentials_returnsJwtToken() {
        String login = "logintest_" + System.currentTimeMillis();

        TutorRegistrationDto regDto = new TutorRegistrationDto();
        regDto.setFullName("Login Tester");
        regDto.setLogin(login);
        regDto.setPassword("myPassword");
        restTemplate.postForEntity("/api/tutors/register", regDto, TutorResponseDto.class);

        TutorLoginDto loginDto = new TutorLoginDto();
        loginDto.setLogin(login);
        loginDto.setPassword("myPassword");

        ResponseEntity<TutorResponseDto> response =
                restTemplate.postForEntity("/api/tutors/login", loginDto, TutorResponseDto.class);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertNotNull(response.getBody().getSessionToken());
        // Verify it's a JWT (3 dot-separated parts)
        String token = response.getBody().getSessionToken();
        assertEquals(3, token.split("\\.").length);
    }

    @Test
    void login_wrongPassword_returns401() {
        String login = "wrongpass_" + System.currentTimeMillis();

        TutorRegistrationDto regDto = new TutorRegistrationDto();
        regDto.setFullName("WrongPass User");
        regDto.setLogin(login);
        regDto.setPassword("correctPassword");
        restTemplate.postForEntity("/api/tutors/register", regDto, TutorResponseDto.class);

        TutorLoginDto loginDto = new TutorLoginDto();
        loginDto.setLogin(login);
        loginDto.setPassword("wrongPassword");

        ResponseEntity<Map> response =
                restTemplate.postForEntity("/api/tutors/login", loginDto, Map.class);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void refreshToken_validRefreshToken_returnsNewAccessToken() {
        // Register and get refresh token
        TutorRegistrationDto dto = new TutorRegistrationDto();
        dto.setFullName("Refresh Tester");
        dto.setLogin("refresh_" + System.currentTimeMillis());
        dto.setPassword("password123");

        ResponseEntity<TutorResponseDto> regResponse =
                restTemplate.postForEntity("/api/tutors/register", dto, TutorResponseDto.class);

        String refreshToken = regResponse.getBody().getRefreshToken();
        assertNotNull(refreshToken);

        // Exchange refresh token for new access token
        Map<String, String> refreshRequest = Map.of("refreshToken", refreshToken);
        ResponseEntity<Map> refreshResponse =
                restTemplate.postForEntity("/api/auth/refresh", refreshRequest, Map.class);

        assertEquals(HttpStatus.OK, refreshResponse.getStatusCode());
        assertNotNull(refreshResponse.getBody().get("accessToken"));
    }
}
