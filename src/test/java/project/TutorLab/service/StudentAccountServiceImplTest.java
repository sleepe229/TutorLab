package project.TutorLab.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import project.TutorLab.config.JwtService;
import project.TutorLab.model.SessionSnapshot;
import project.TutorLab.model.Student;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.LessonRecapRepository;
import project.TutorLab.repository.SessionSnapshotRepository;
import project.TutorLab.repository.StudentAccountRepository;
import project.TutorLab.repository.StudentRepository;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.impl.StudentAccountServiceImpl;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StudentAccountServiceImplTest {

    @Mock private StudentAccountRepository accountRepository;
    @Mock private JwtService jwtService;
    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ValueOperations<String, Object> valueOperations;
    @Mock private SessionSnapshotRepository sessionSnapshotRepository;
    @Mock private LessonRecapRepository lessonRecapRepository;
    @Mock private StudentRepository studentRepository;
    @Mock private TutorRepository tutorRepository;
    @Mock private GoogleAuthService googleAuthService;

    @InjectMocks
    private StudentAccountServiceImpl service;

    private StudentAccount account;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(jwtService.generateStudentToken(anyString())).thenReturn("student.jwt.token");

        account = new StudentAccount("acc-1", "ivan@test.com",
                "$2a$10$hash", "Иван", "Иванов");
        account.setLinkedStudentIds(new ArrayList<>());
    }

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    void register_validData_returnsResponseWithTokens() {
        when(accountRepository.existsByEmail("new@test.com")).thenReturn(false);
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = service.register("new@test.com", "password123",
                "Мария", "Петрова", null);

        assertNotNull(result);
        assertEquals("student.jwt.token", result.get("accessToken"));
        assertNotNull(result.get("refreshToken"));
        assertEquals("Мария", result.get("firstName"));
        verify(valueOperations).set(contains("student_refresh:"), anyString(), anyLong(), any());
    }

    @Test
    void register_shortPassword_throwsIllegalArgument() {
        assertThrows(IllegalArgumentException.class, () ->
                service.register("test@test.com", "short", "A", "B", null));
        verify(accountRepository, never()).save(any());
    }

    @Test
    void register_nullPassword_throwsIllegalArgument() {
        assertThrows(IllegalArgumentException.class, () ->
                service.register("test@test.com", null, "A", "B", null));
    }

    @Test
    void register_duplicateEmail_throwsIllegalArgument() {
        when(accountRepository.existsByEmail("ivan@test.com")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () ->
                service.register("ivan@test.com", "password123", "X", "Y", null));
        verify(accountRepository, never()).save(any());
    }

    @Test
    void register_withLinkedStudentId_addsToList() {
        when(accountRepository.existsByEmail("new@test.com")).thenReturn(false);
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = service.register("new@test.com", "password123",
                "A", "B", "student-42");

        @SuppressWarnings("unchecked")
        List<String> linkedIds = (List<String>) result.get("linkedStudentIds");
        assertNotNull(linkedIds);
        assertTrue(linkedIds.contains("student-42"));
    }

    @Test
    void register_withBlankLinkedStudentId_doesNotAddToList() {
        when(accountRepository.existsByEmail("new@test.com")).thenReturn(false);
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = service.register("new@test.com", "password123",
                "A", "B", "  ");

        @SuppressWarnings("unchecked")
        List<String> linkedIds = (List<String>) result.get("linkedStudentIds");
        assertTrue(linkedIds == null || linkedIds.isEmpty());
    }

    // ── login ─────────────────────────────────────────────────────────────────

    @Test
    void login_validCredentials_returnsTokens() {
        // Use a real BCrypt hash for "password123"
        account.setPasswordHash(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                .encode("password123"));
        when(accountRepository.findByEmail("ivan@test.com")).thenReturn(account);

        Map<String, Object> result = service.login("ivan@test.com", "password123");

        assertNotNull(result);
        assertEquals("student.jwt.token", result.get("accessToken"));
        assertEquals("Иван", result.get("firstName"));
    }

    @Test
    void login_wrongPassword_throwsIllegalArgument() {
        account.setPasswordHash(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                .encode("correctPass"));
        when(accountRepository.findByEmail("ivan@test.com")).thenReturn(account);

        assertThrows(IllegalArgumentException.class, () ->
                service.login("ivan@test.com", "wrongPass"));
    }

    @Test
    void login_unknownEmail_throwsIllegalArgument() {
        when(accountRepository.findByEmail("unknown@test.com")).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () ->
                service.login("unknown@test.com", "pass"));
    }

    // ── refresh ───────────────────────────────────────────────────────────────

    @Test
    void refresh_validToken_rotatesTokenAndReturnsNewPair() {
        when(valueOperations.get("student_refresh:old-token")).thenReturn("acc-1");
        when(accountRepository.findById("acc-1")).thenReturn(account);

        Map<String, Object> result = service.refresh("old-token");

        assertNotNull(result);
        assertEquals("student.jwt.token", result.get("accessToken"));
        assertNotNull(result.get("refreshToken"));
        assertNotEquals("old-token", result.get("refreshToken")); // rotated
        verify(redisTemplate).delete("student_refresh:old-token");
        verify(valueOperations).set(startsWith("student_refresh:"), anyString(), anyLong(), any());
    }

    @Test
    void refresh_invalidToken_throwsIllegalArgument() {
        when(valueOperations.get("student_refresh:bad")).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> service.refresh("bad"));
    }

    @Test
    void refresh_accountDeletedAfterTokenIssued_throwsIllegalArgument() {
        when(valueOperations.get("student_refresh:orphan")).thenReturn("deleted-acc");
        when(accountRepository.findById("deleted-acc")).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> service.refresh("orphan"));
    }

    // ── logout ────────────────────────────────────────────────────────────────

    @Test
    void logout_deletesRefreshTokenFromRedis() {
        service.logout("my-refresh-token");
        verify(redisTemplate).delete("student_refresh:my-refresh-token");
    }

    // ── getById ───────────────────────────────────────────────────────────────

    @Test
    void getById_existingId_returnsAccount() {
        when(accountRepository.findById("acc-1")).thenReturn(account);
        StudentAccount result = service.getById("acc-1");
        assertNotNull(result);
        assertEquals("acc-1", result.getId());
    }

    @Test
    void getById_unknownId_returnsNull() {
        when(accountRepository.findById("unknown")).thenReturn(null);
        assertNull(service.getById("unknown"));
    }

    // ── linkToStudent ─────────────────────────────────────────────────────────

    @Test
    void linkToStudent_addsIdWhenNotPresent() {
        when(accountRepository.findById("acc-1")).thenReturn(account);

        service.linkToStudent("acc-1", "student-99");

        assertTrue(account.getLinkedStudentIds().contains("student-99"));
        verify(accountRepository).save(account);
    }

    @Test
    void linkToStudent_idempotent_doesNotDuplicate() {
        account.getLinkedStudentIds().add("student-99");
        when(accountRepository.findById("acc-1")).thenReturn(account);

        service.linkToStudent("acc-1", "student-99");

        assertEquals(1, account.getLinkedStudentIds().stream()
                .filter("student-99"::equals).count());
        verify(accountRepository, never()).save(any()); // no save needed
    }

    @Test
    void linkToStudent_accountNotFound_throwsIllegalArgument() {
        when(accountRepository.findById("missing")).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () ->
                service.linkToStudent("missing", "student-1"));
    }

    // ── updateAccount ─────────────────────────────────────────────────────────

    @Test
    void updateAccount_nameOnly_updatesNameWithoutPasswordChange() {
        when(accountRepository.findById("acc-1")).thenReturn(account);

        Map<String, Object> result = service.updateAccount("acc-1", "Новое", "Имя",
                null, null);

        assertEquals("Новое", result.get("firstName"));
        assertEquals("Имя", result.get("lastName"));
        verify(accountRepository).save(account);
    }

    @Test
    void updateAccount_changePassword_requiresCorrectCurrentPassword() {
        String currentHash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                .encode("oldPass");
        account.setPasswordHash(currentHash);
        when(accountRepository.findById("acc-1")).thenReturn(account);

        // Should succeed
        assertDoesNotThrow(() ->
                service.updateAccount("acc-1", null, null, "oldPass", "newPassword123"));
        verify(accountRepository).save(account);
    }

    @Test
    void updateAccount_changePassword_wrongCurrentPassword_throws() {
        String currentHash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                .encode("correctPass");
        account.setPasswordHash(currentHash);
        when(accountRepository.findById("acc-1")).thenReturn(account);

        assertThrows(IllegalArgumentException.class, () ->
                service.updateAccount("acc-1", null, null, "wrongPass", "newPassword123"));
    }

    @Test
    void updateAccount_changePassword_tooShort_throws() {
        String currentHash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                .encode("oldPass");
        account.setPasswordHash(currentHash);
        when(accountRepository.findById("acc-1")).thenReturn(account);

        assertThrows(IllegalArgumentException.class, () ->
                service.updateAccount("acc-1", null, null, "oldPass", "short"));
    }

    @Test
    void updateAccount_accountNotFound_throws() {
        when(accountRepository.findById("missing")).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () ->
                service.updateAccount("missing", "A", "B", null, null));
    }

    // ── updatePhotoUrl ────────────────────────────────────────────────────────

    @Test
    void updatePhotoUrl_setsUrlAndReturns() {
        when(accountRepository.findById("acc-1")).thenReturn(account);

        Map<String, Object> result = service.updatePhotoUrl("acc-1", "/api/upload/pic.jpg");

        assertEquals("/api/upload/pic.jpg", result.get("photoUrl"));
        verify(accountRepository).save(account);
    }

    @Test
    void updatePhotoUrl_accountNotFound_throws() {
        when(accountRepository.findById("missing")).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () ->
                service.updatePhotoUrl("missing", "/some/url"));
    }

    // ── googleAuth ────────────────────────────────────────────────────────────

    @Test
    void googleAuth_newUser_createsAccountAndReturnsTokens() {
        GoogleAuthService.GoogleUserInfo info = new GoogleAuthService.GoogleUserInfo(
                "google-sub-1", "new@gmail.com", "Анна", "Смирнова",
                "Анна Смирнова", "https://photo.url");

        when(googleAuthService.verify("id_token_new")).thenReturn(info);
        when(accountRepository.findByGoogleId("google-sub-1")).thenReturn(null);
        when(accountRepository.findByEmail("new@gmail.com")).thenReturn(null);
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = service.googleAuth("id_token_new");

        assertNotNull(result);
        assertEquals("student.jwt.token", result.get("accessToken"));
        assertEquals("Анна", result.get("firstName"));
        verify(accountRepository).save(argThat(a -> "google-sub-1".equals(a.getGoogleId())));
    }

    @Test
    void googleAuth_existingGoogleUser_returnsTokensWithoutCreating() {
        GoogleAuthService.GoogleUserInfo info = new GoogleAuthService.GoogleUserInfo(
                "google-sub-1", "ivan@test.com", "Иван", "Иванов",
                "Иван Иванов", null);

        account.setGoogleId("google-sub-1");
        when(googleAuthService.verify("id_token_existing")).thenReturn(info);
        when(accountRepository.findByGoogleId("google-sub-1")).thenReturn(account);
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> result = service.googleAuth("id_token_existing");

        assertNotNull(result);
        assertEquals("acc-1", result.get("studentAccountId"));
    }

    @Test
    void googleAuth_existingEmailAccount_linksGoogleId() {
        GoogleAuthService.GoogleUserInfo info = new GoogleAuthService.GoogleUserInfo(
                "google-sub-new", "ivan@test.com", "Иван", "Иванов",
                "Иван Иванов", null);

        when(googleAuthService.verify("id_token_link")).thenReturn(info);
        when(accountRepository.findByGoogleId("google-sub-new")).thenReturn(null);
        when(accountRepository.findByEmail("ivan@test.com")).thenReturn(account); // existing by email
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        service.googleAuth("id_token_link");

        // Google ID should be attached to the existing account
        assertEquals("google-sub-new", account.getGoogleId());
        verify(accountRepository).save(account);
    }

    // ── getStudentHistory ─────────────────────────────────────────────────────

    @Test
    void getStudentHistory_accountNotFound_returnsEmpty() {
        when(accountRepository.findById("missing")).thenReturn(null);
        assertTrue(service.getStudentHistory("missing").isEmpty());
    }

    @Test
    void getStudentHistory_noLinkedStudents_returnsEmpty() {
        when(accountRepository.findById("acc-1")).thenReturn(account);
        // account has no linked students
        assertTrue(service.getStudentHistory("acc-1").isEmpty());
    }

    @Test
    void getStudentHistory_withSnapshots_returnsDtoSortedByDateDesc() {
        account.getLinkedStudentIds().add("student-1");

        Student student = new Student();
        student.setId("student-1");
        student.setFirstName("Иван");
        student.setLastName("Иванов");
        student.setTutorId("tutor-1");

        Tutor tutor = new Tutor();
        tutor.setId("tutor-1");
        tutor.setFullName("Репетитор");

        SessionSnapshot snap1 = new SessionSnapshot();
        snap1.setId("snap-1");
        snap1.setTitle("Урок 1");
        snap1.setEndedAt(LocalDateTime.now().minusDays(2));
        snap1.setStudentFirstName("Иван");
        snap1.setStudentLastName("Иванов");
        snap1.setTutorId("tutor-1");

        SessionSnapshot snap2 = new SessionSnapshot();
        snap2.setId("snap-2");
        snap2.setTitle("Урок 2");
        snap2.setEndedAt(LocalDateTime.now().minusDays(1));
        snap2.setStudentFirstName("Иван");
        snap2.setStudentLastName("Иванов");
        snap2.setTutorId("tutor-1");

        when(accountRepository.findById("acc-1")).thenReturn(account);
        when(sessionSnapshotRepository.findByStudentId("student-1"))
                .thenReturn(new ArrayList<>(List.of(snap1, snap2)));
        when(studentRepository.findById("student-1")).thenReturn(student);
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);
        when(lessonRecapRepository.findBySnapshotId(anyString())).thenReturn(null);

        var history = service.getStudentHistory("acc-1");

        assertEquals(1, history.size());
        assertEquals("student-1", history.get(0).getStudentId());
        assertEquals(2, history.get(0).getSessions().size());
        // Newest first
        assertEquals("snap-2", history.get(0).getSessions().get(0).getSnapshotId());
    }
}
