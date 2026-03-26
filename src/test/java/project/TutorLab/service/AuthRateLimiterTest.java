package project.TutorLab.service;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthRateLimiterTest {

    private AuthRateLimiter rateLimiter;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        rateLimiter = new AuthRateLimiter();
        // Override bucket4j limits to very small values for fast testing
        ReflectionTestUtils.setField(rateLimiter, "loginAttempts", 3);
        ReflectionTestUtils.setField(rateLimiter, "loginWindowSeconds", 60);
        ReflectionTestUtils.setField(rateLimiter, "registerAttempts", 2);
        ReflectionTestUtils.setField(rateLimiter, "registerWindowSeconds", 300);

        request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    }

    // ── checkLoginLimit ───────────────────────────────────────────────────────

    @Test
    void checkLoginLimit_firstAttempt_doesNotThrow() {
        assertDoesNotThrow(() -> rateLimiter.checkLoginLimit(request));
    }

    @Test
    void checkLoginLimit_withinLimit_doesNotThrow() {
        // loginAttempts = 3; first 3 should all pass
        for (int i = 0; i < 3; i++) {
            assertDoesNotThrow(() -> rateLimiter.checkLoginLimit(request));
        }
    }

    @Test
    void checkLoginLimit_exceedsLimit_throws429() {
        // Exhaust the bucket (3 attempts)
        for (int i = 0; i < 3; i++) {
            rateLimiter.checkLoginLimit(request);
        }
        // 4th attempt must be rejected
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> rateLimiter.checkLoginLimit(request));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());
    }

    @Test
    void checkLoginLimit_differentIps_trackedIndependently() {
        HttpServletRequest request2 = mock(HttpServletRequest.class);
        when(request2.getRemoteAddr()).thenReturn("10.0.0.2");

        // Exhaust IP1
        for (int i = 0; i < 3; i++) rateLimiter.checkLoginLimit(request);
        assertThrows(ResponseStatusException.class, () -> rateLimiter.checkLoginLimit(request));

        // IP2 should still have its own fresh bucket
        assertDoesNotThrow(() -> rateLimiter.checkLoginLimit(request2));
    }

    @Test
    void checkLoginLimit_usesXForwardedForHeader() {
        when(request.getHeader("X-Forwarded-For")).thenReturn("1.2.3.4, 10.0.0.1");

        // Should use first IP from X-Forwarded-For (1.2.3.4), not remoteAddr
        assertDoesNotThrow(() -> rateLimiter.checkLoginLimit(request));
    }

    // ── checkRegisterLimit ────────────────────────────────────────────────────

    @Test
    void checkRegisterLimit_withinLimit_doesNotThrow() {
        // registerAttempts = 2
        for (int i = 0; i < 2; i++) {
            assertDoesNotThrow(() -> rateLimiter.checkRegisterLimit(request));
        }
    }

    @Test
    void checkRegisterLimit_exceedsLimit_throws429() {
        for (int i = 0; i < 2; i++) {
            rateLimiter.checkRegisterLimit(request);
        }
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> rateLimiter.checkRegisterLimit(request));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());
    }

    @Test
    void loginAndRegisterBuckets_areTrackedSeparately() {
        // Exhaust login bucket
        for (int i = 0; i < 3; i++) rateLimiter.checkLoginLimit(request);
        assertThrows(ResponseStatusException.class, () -> rateLimiter.checkLoginLimit(request));

        // Register bucket for same IP should still be available
        assertDoesNotThrow(() -> rateLimiter.checkRegisterLimit(request));
    }
}
