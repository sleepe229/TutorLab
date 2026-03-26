package project.TutorLab.controller;

import org.junit.jupiter.api.BeforeEach;
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
import project.TutorLab.dto.*;
import project.TutorLab.service.AuthRateLimiter;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class StudentControllerIntegrationTest {

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

    /** Registers a fresh tutor and returns (tutorId, sessionToken) */
    private TutorResponseDto registerTutor() {
        TutorRegistrationDto dto = new TutorRegistrationDto();
        dto.setFullName("Integration Tutor");
        dto.setLogin("student_it_" + System.currentTimeMillis());
        dto.setPassword("password123");
        ResponseEntity<TutorResponseDto> resp =
                restTemplate.postForEntity("/api/tutors/register", dto, TutorResponseDto.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode());
        return resp.getBody();
    }

    private HttpHeaders authHeader(String token) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-Session-Token", token);
        return h;
    }

    // ── createStudent ─────────────────────────────────────────────────────────

    @Test
    void createStudent_authenticated_returns201() {
        TutorResponseDto tutor = registerTutor();
        StudentCreateDto createDto = new StudentCreateDto();
        createDto.setFirstName("Алиса");
        createDto.setLastName("Иванова");
        createDto.setAge(14);

        HttpEntity<StudentCreateDto> request = new HttpEntity<>(createDto, authHeader(tutor.getSessionToken()));
        ResponseEntity<StudentResponseDto> resp = restTemplate.exchange(
                "/api/students/tutor/" + tutor.getId(),
                HttpMethod.POST, request, StudentResponseDto.class);

        assertEquals(HttpStatus.CREATED, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertEquals("Алиса", resp.getBody().getFirstName());
        assertNotNull(resp.getBody().getId());
    }

    @Test
    void createStudent_noAuth_returns403() {
        TutorResponseDto tutor = registerTutor();
        StudentCreateDto createDto = new StudentCreateDto();
        createDto.setFirstName("Test");

        // Using a different (empty) token — interceptor will reject
        ResponseEntity<Void> resp = restTemplate.postForEntity(
                "/api/students/tutor/" + tutor.getId(), createDto, Void.class);

        // No token → interceptor returns 401 or 403
        assertTrue(resp.getStatusCode().is4xxClientError());
    }

    // ── getStudentById ────────────────────────────────────────────────────────

    @Test
    void getStudentById_existingStudent_returns200() {
        TutorResponseDto tutor = registerTutor();
        // Create student first
        StudentCreateDto createDto = new StudentCreateDto();
        createDto.setFirstName("Борис");
        HttpEntity<StudentCreateDto> createReq = new HttpEntity<>(createDto, authHeader(tutor.getSessionToken()));
        StudentResponseDto created = restTemplate.exchange(
                "/api/students/tutor/" + tutor.getId(),
                HttpMethod.POST, createReq, StudentResponseDto.class).getBody();

        assertNotNull(created);
        HttpEntity<Void> getReq = new HttpEntity<>(authHeader(tutor.getSessionToken()));
        ResponseEntity<StudentResponseDto> resp = restTemplate.exchange(
                "/api/students/" + created.getId(),
                HttpMethod.GET, getReq, StudentResponseDto.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertEquals("Борис", resp.getBody().getFirstName());
    }

    @Test
    void getStudentById_unknownId_returns404() {
        TutorResponseDto tutor = registerTutor();
        HttpEntity<Void> req = new HttpEntity<>(authHeader(tutor.getSessionToken()));
        ResponseEntity<Void> resp = restTemplate.exchange(
                "/api/students/nonexistent-id", HttpMethod.GET, req, Void.class);
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── getAllStudentsByTutor ─────────────────────────────────────────────────

    @Test
    void getAllStudentsByTutor_returns200WithCreatedStudent() {
        TutorResponseDto tutor = registerTutor();
        StudentCreateDto createDto = new StudentCreateDto();
        createDto.setFirstName("Вера");
        HttpEntity<StudentCreateDto> createReq = new HttpEntity<>(createDto, authHeader(tutor.getSessionToken()));
        restTemplate.exchange("/api/students/tutor/" + tutor.getId(),
                HttpMethod.POST, createReq, StudentResponseDto.class);

        HttpEntity<Void> getReq = new HttpEntity<>(authHeader(tutor.getSessionToken()));
        ResponseEntity<List> resp = restTemplate.exchange(
                "/api/students/tutor/" + tutor.getId(), HttpMethod.GET, getReq, List.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertFalse(resp.getBody().isEmpty());
    }

    // ── addLessonDate ─────────────────────────────────────────────────────────

    @Test
    void addLessonDate_returns200WithUpdatedDates() {
        TutorResponseDto tutor = registerTutor();
        StudentCreateDto createDto = new StudentCreateDto();
        createDto.setFirstName("Гриша");
        HttpEntity<StudentCreateDto> createReq = new HttpEntity<>(createDto, authHeader(tutor.getSessionToken()));
        StudentResponseDto student = restTemplate.exchange(
                "/api/students/tutor/" + tutor.getId(),
                HttpMethod.POST, createReq, StudentResponseDto.class).getBody();

        assertNotNull(student);
        Map<String, String> body = Map.of("lessonDate", "2025-09-10 10:00");
        HttpEntity<Map<String, String>> req = new HttpEntity<>(body, authHeader(tutor.getSessionToken()));
        ResponseEntity<StudentResponseDto> resp = restTemplate.exchange(
                "/api/students/" + student.getId() + "/lessons",
                HttpMethod.POST, req, StudentResponseDto.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertTrue(resp.getBody().getLessonDates().contains("2025-09-10 10:00"));
    }

    // ── deleteStudent ─────────────────────────────────────────────────────────

    @Test
    void deleteStudent_returns204_thenGetReturns404() {
        TutorResponseDto tutor = registerTutor();
        StudentCreateDto createDto = new StudentCreateDto();
        createDto.setFirstName("Дима");
        HttpEntity<StudentCreateDto> createReq = new HttpEntity<>(createDto, authHeader(tutor.getSessionToken()));
        StudentResponseDto student = restTemplate.exchange(
                "/api/students/tutor/" + tutor.getId(),
                HttpMethod.POST, createReq, StudentResponseDto.class).getBody();

        assertNotNull(student);
        HttpEntity<Void> deleteReq = new HttpEntity<>(authHeader(tutor.getSessionToken()));
        ResponseEntity<Void> deleteResp = restTemplate.exchange(
                "/api/students/" + student.getId(), HttpMethod.DELETE, deleteReq, Void.class);

        assertEquals(HttpStatus.NO_CONTENT, deleteResp.getStatusCode());

        // Subsequent GET returns 404
        ResponseEntity<Void> getResp = restTemplate.exchange(
                "/api/students/" + student.getId(), HttpMethod.GET, deleteReq, Void.class);
        assertEquals(HttpStatus.NOT_FOUND, getResp.getStatusCode());
    }

    // ── progress notes ────────────────────────────────────────────────────────

    @Test
    void addProgressNote_andGet_returns200WithNote() {
        TutorResponseDto tutor = registerTutor();
        StudentCreateDto createDto = new StudentCreateDto();
        createDto.setFirstName("Ева");
        HttpEntity<StudentCreateDto> createReq = new HttpEntity<>(createDto, authHeader(tutor.getSessionToken()));
        StudentResponseDto student = restTemplate.exchange(
                "/api/students/tutor/" + tutor.getId(),
                HttpMethod.POST, createReq, StudentResponseDto.class).getBody();

        assertNotNull(student);

        Map<String, Object> noteBody = Map.of("noteText", "Отлично поработали над темой", "rating", 5);
        HttpEntity<Map<String, Object>> noteReq = new HttpEntity<>(noteBody, authHeader(tutor.getSessionToken()));
        ResponseEntity<Map> addResp = restTemplate.exchange(
                "/api/students/" + student.getId() + "/progress-notes",
                HttpMethod.POST, noteReq, Map.class);

        assertEquals(HttpStatus.OK, addResp.getStatusCode());
        assertNotNull(addResp.getBody().get("noteId"));

        // GET notes
        ResponseEntity<List> getResp = restTemplate.exchange(
                "/api/students/" + student.getId() + "/progress-notes",
                HttpMethod.GET, new HttpEntity<>(authHeader(tutor.getSessionToken())), List.class);

        assertEquals(HttpStatus.OK, getResp.getStatusCode());
        assertFalse(getResp.getBody().isEmpty());
    }
}
