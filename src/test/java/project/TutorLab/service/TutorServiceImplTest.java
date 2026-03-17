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
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.impl.TutorServiceImpl;

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
}