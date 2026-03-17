package project.TutorLab.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        // 64-char secret = 512 bits (well above HS256 minimum of 256 bits)
        ReflectionTestUtils.setField(jwtService, "secret",
                "TestSecretKeyForJWTThatIsAtLeast256BitsLongAndThenSome12345678");
        ReflectionTestUtils.setField(jwtService, "accessTtlMinutes", 15L);
    }

    @Test
    void generateAccessToken_returnsNonBlankJwt() {
        String token = jwtService.generateAccessToken("user-123");
        assertNotNull(token);
        assertFalse(token.isBlank());
        // JWT format: header.payload.signature
        assertEquals(3, token.split("\\.").length);
    }

    @Test
    void extractTutorId_returnsCorrectSubject() {
        String token = jwtService.generateAccessToken("tutor-abc");
        assertEquals("tutor-abc", jwtService.extractTutorId(token));
    }

    @Test
    void isTokenValid_validToken_returnsTrue() {
        String token = jwtService.generateAccessToken("user-123");
        assertTrue(jwtService.isTokenValid(token));
    }

    @Test
    void isTokenValid_tamperedToken_returnsFalse() {
        String token = jwtService.generateAccessToken("user-123");
        String tampered = token.substring(0, token.length() - 5) + "XXXXX";
        assertFalse(jwtService.isTokenValid(tampered));
    }

    @Test
    void isTokenValid_randomString_returnsFalse() {
        assertFalse(jwtService.isTokenValid("not.a.jwt"));
    }

    @Test
    void isTokenValid_expiredToken_returnsFalse() {
        // Set TTL to 0 minutes so token expires immediately
        ReflectionTestUtils.setField(jwtService, "accessTtlMinutes", 0L);
        String token = jwtService.generateAccessToken("user-expired");
        // Token with 0-minute TTL is expired right after creation
        assertFalse(jwtService.isTokenValid(token));
    }

    @Test
    void isTokenValid_wrongSecret_returnsFalse() {
        String token = jwtService.generateAccessToken("user-123");

        JwtService otherService = new JwtService();
        ReflectionTestUtils.setField(otherService, "secret",
                "DifferentSecretKeyThatIsAlsoAtLeast256BitsLong123456789012");
        ReflectionTestUtils.setField(otherService, "accessTtlMinutes", 15L);

        assertFalse(otherService.isTokenValid(token));
    }
}