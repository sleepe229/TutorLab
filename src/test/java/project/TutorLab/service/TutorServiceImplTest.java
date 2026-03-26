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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import project.TutorLab.config.JwtService;
import project.TutorLab.dto.TutorLoginDto;
import project.TutorLab.dto.TutorRegistrationDto;
import project.TutorLab.dto.TutorResponseDto;
import project.TutorLab.dto.TutorUpdateDto;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.GoogleAuthService;
import project.TutorLab.service.IndexNowService;
import project.TutorLab.service.impl.TutorServiceImpl;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TutorServiceImplTest {

    @Mock
    private TutorRepository tutorRepository;

    @Mock
    private BCryptPasswordEncoder passwordEncoder;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    @Mock
    private JwtService jwtService;

    @Mock
    private GoogleAuthService googleAuthService;

    @Mock
    private IndexNowService indexNowService;

    @InjectMocks
    private TutorServiceImpl tutorService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(jwtService.generateAccessToken(anyString())).thenReturn("mock.jwt.token");
    }

    @Test
    void registerTutor_success() {
        TutorRegistrationDto dto = new TutorRegistrationDto();
        dto.setFullName("Test User");
        dto.setLogin("testuser");
        dto.setPassword("password123");

        when(tutorRepository.existsByLogin("testuser")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("$2a$hash");
        when(tutorRepository.save(any(Tutor.class))).thenAnswer(inv -> inv.getArgument(0));

        TutorResponseDto result = tutorService.registerTutor(dto);

        assertNotNull(result);
        assertEquals("Test User", result.getFullName());
        assertEquals("testuser", result.getLogin());
        assertNotNull(result.getSessionToken()); // JWT access token
        assertNotNull(result.getRefreshToken());
        verify(passwordEncoder).encode("password123");
        verify(valueOperations).set(contains("refresh:"), any(), anyLong(), any());
    }

    @Test
    void registerTutor_duplicateLogin_throwsConflict() {
        TutorRegistrationDto dto = new TutorRegistrationDto();
        dto.setLogin("existing");
        dto.setPassword("pass");
        dto.setFullName("User");

        when(tutorRepository.existsByLogin("existing")).thenReturn(true);

        assertThrows(ResponseStatusException.class, () -> tutorService.registerTutor(dto));
    }

    @Test
    void loginTutor_correctPassword_returnsToken() {
        TutorLoginDto dto = new TutorLoginDto();
        dto.setLogin("user");
        dto.setPassword("correctPass");

        Tutor tutor = new Tutor("id1", "User", "user", "$2a$encodedHash");
        when(tutorRepository.findByLogin("user")).thenReturn(tutor);
        when(passwordEncoder.matches("correctPass", "$2a$encodedHash")).thenReturn(true);

        TutorResponseDto result = tutorService.loginTutor(dto);

        assertNotNull(result);
        assertNotNull(result.getSessionToken());
    }

    @Test
    void loginTutor_wrongPassword_throwsUnauthorized() {
        TutorLoginDto dto = new TutorLoginDto();
        dto.setLogin("user");
        dto.setPassword("wrongPass");

        Tutor tutor = new Tutor("id1", "User", "user", "$2a$encodedHash");
        when(tutorRepository.findByLogin("user")).thenReturn(tutor);
        when(passwordEncoder.matches("wrongPass", "$2a$encodedHash")).thenReturn(false);

        assertThrows(ResponseStatusException.class, () -> tutorService.loginTutor(dto));
    }

    @Test
    void loginTutor_nonExistentUser_throwsUnauthorized() {
        TutorLoginDto dto = new TutorLoginDto();
        dto.setLogin("nonexistent");
        dto.setPassword("pass");

        when(tutorRepository.findByLogin("nonexistent")).thenReturn(null);

        assertThrows(ResponseStatusException.class, () -> tutorService.loginTutor(dto));
    }

    // ── getTutorById ──────────────────────────────────────────────────────────

    @Test
    void getTutorById_existingId_returnsDto() {
        Tutor tutor = new Tutor("id1", "Alice", "alice", null);
        tutor.setStudentIds(new ArrayList<>());
        when(tutorRepository.findById("id1")).thenReturn(tutor);

        TutorResponseDto result = tutorService.getTutorById("id1");

        assertNotNull(result);
        assertEquals("id1", result.getId());
        assertEquals("Alice", result.getFullName());
    }

    @Test
    void getTutorById_unknownId_returnsNull() {
        when(tutorRepository.findById("bad")).thenReturn(null);
        assertNull(tutorService.getTutorById("bad"));
    }

    // ── tutorExists ───────────────────────────────────────────────────────────

    @Test
    void tutorExists_returnsTrueWhenFound() {
        when(tutorRepository.existsById("id1")).thenReturn(true);
        assertTrue(tutorService.tutorExists("id1"));
    }

    @Test
    void tutorExists_returnsFalseWhenNotFound() {
        when(tutorRepository.existsById("bad")).thenReturn(false);
        assertFalse(tutorService.tutorExists("bad"));
    }

    // ── loginExists ───────────────────────────────────────────────────────────

    @Test
    void loginExists_returnsTrueWhenFound() {
        when(tutorRepository.existsByLogin("alice")).thenReturn(true);
        assertTrue(tutorService.loginExists("alice"));
    }

    // ── getPublicTutors ───────────────────────────────────────────────────────

    @Test
    void getPublicTutors_returnsPublicList_withPrivateFieldsStripped() {
        Tutor t = new Tutor("t1", "Bob", "bob", null);
        t.setStudentIds(List.of("s1", "s2"));
        t.setPublicProfile(true);
        when(tutorRepository.findAllPublic()).thenReturn(List.of(t));

        List<TutorResponseDto> result = tutorService.getPublicTutors();

        assertEquals(1, result.size());
        assertNull(result.get(0).getLogin());       // stripped
        assertNull(result.get(0).getStudentIds());  // stripped
        assertEquals("Bob", result.get(0).getFullName());
    }

    // ── updateTutor ───────────────────────────────────────────────────────────

    @Test
    void updateTutor_updatesFieldsAndSaves() {
        Tutor tutor = new Tutor("t1", "Old Name", "user", null);
        tutor.setStudentIds(new ArrayList<>());
        when(tutorRepository.findById("t1")).thenReturn(tutor);
        when(tutorRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TutorUpdateDto dto = new TutorUpdateDto();
        dto.setFullName("New Name");
        dto.setAbout("Experienced tutor");

        TutorResponseDto result = tutorService.updateTutor("t1", dto);

        assertEquals("New Name", result.getFullName());
        assertEquals("Experienced tutor", result.getAbout());
        verify(tutorRepository).save(any());
    }

    @Test
    void updateTutor_notFound_throwsNotFound() {
        when(tutorRepository.findById("bad")).thenReturn(null);

        assertThrows(ResponseStatusException.class,
                () -> tutorService.updateTutor("bad", new TutorUpdateDto()));
    }

    @Test
    void updateTutor_firstMadePublic_callsIndexNow() {
        Tutor tutor = new Tutor("t1", "Name", "user", null);
        tutor.setStudentIds(new ArrayList<>());
        tutor.setPublicProfile(false); // was private
        when(tutorRepository.findById("t1")).thenReturn(tutor);
        when(tutorRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TutorUpdateDto dto = new TutorUpdateDto();
        dto.setIsPublicProfile(true);

        tutorService.updateTutor("t1", dto);

        verify(indexNowService).submitUrl(anyString());
    }

    // ── googleAuth ────────────────────────────────────────────────────────────

    @Test
    void googleAuth_newUser_createsAndSaves() {
        GoogleAuthService.GoogleUserInfo info = new GoogleAuthService.GoogleUserInfo(
                "google-sub-1", "alice@gmail.com", "Alice", "Smith", "Alice Smith", null);
        when(googleAuthService.verify("token")).thenReturn(info);
        when(tutorRepository.findByGoogleId("google-sub-1")).thenReturn(null);
        when(tutorRepository.findByEmail("alice@gmail.com")).thenReturn(null);
        when(tutorRepository.existsByLogin(anyString())).thenReturn(false);
        when(tutorRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TutorResponseDto result = tutorService.googleAuth("token");

        assertNotNull(result);
        assertEquals("Alice Smith", result.getFullName());
        verify(tutorRepository).save(any(Tutor.class));
    }

    @Test
    void googleAuth_existingByGoogleId_returnsExistingAccount() {
        Tutor existing = new Tutor("t1", "Alice", "alice", null);
        existing.setGoogleId("google-sub-1");
        existing.setStudentIds(new ArrayList<>());
        GoogleAuthService.GoogleUserInfo info = new GoogleAuthService.GoogleUserInfo(
                "google-sub-1", "alice@gmail.com", "Alice", "Smith", "Alice Smith", null);
        when(googleAuthService.verify("token")).thenReturn(info);
        when(tutorRepository.findByGoogleId("google-sub-1")).thenReturn(existing);
        when(tutorRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TutorResponseDto result = tutorService.googleAuth("token");

        assertEquals("t1", result.getId());
    }

    @Test
    void googleAuth_existingByEmail_linksGoogleId() {
        Tutor byEmail = new Tutor("t2", "Bob", "bob", "$2a$hash");
        byEmail.setStudentIds(new ArrayList<>());
        GoogleAuthService.GoogleUserInfo info = new GoogleAuthService.GoogleUserInfo(
                "google-sub-2", "bob@gmail.com", "Bob", "Jones", "Bob Jones", null);
        when(googleAuthService.verify("token")).thenReturn(info);
        when(tutorRepository.findByGoogleId("google-sub-2")).thenReturn(null);
        when(tutorRepository.findByEmail("bob@gmail.com")).thenReturn(byEmail);
        when(tutorRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TutorResponseDto result = tutorService.googleAuth("token");

        assertEquals("t2", result.getId());
        // Google ID should be linked
        assertEquals("google-sub-2", byEmail.getGoogleId());
    }
}