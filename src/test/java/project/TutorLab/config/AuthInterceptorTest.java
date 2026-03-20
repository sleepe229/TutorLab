package project.TutorLab.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthInterceptorTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @InjectMocks
    private AuthInterceptor interceptor;

    @Test
    void preHandle_missingToken_returns401() throws Exception {
        when(request.getHeader("X-Session-Token")).thenReturn(null);

        boolean result = interceptor.preHandle(request, response, new Object());

        assertFalse(result);
        verify(response).sendError(eq(HttpServletResponse.SC_UNAUTHORIZED), anyString());
    }

    @Test
    void preHandle_blankToken_returns401() throws Exception {
        when(request.getHeader("X-Session-Token")).thenReturn("   ");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertFalse(result);
        verify(response).sendError(eq(HttpServletResponse.SC_UNAUTHORIZED), anyString());
    }

    @Test
    void preHandle_invalidToken_returns401() throws Exception {
        when(request.getHeader("X-Session-Token")).thenReturn("invalid.jwt.token");
        when(jwtService.isTokenValid("invalid.jwt.token")).thenReturn(false);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertFalse(result);
        verify(response).sendError(eq(HttpServletResponse.SC_UNAUTHORIZED), anyString());
    }

    @Test
    void preHandle_validToken_setsAttributeAndReturnsTrue() throws Exception {
        String token = "valid.jwt.token";
        when(request.getHeader("X-Session-Token")).thenReturn(token);
        when(jwtService.isTokenValid(token)).thenReturn(true);
        when(jwtService.extractRole(token)).thenReturn("TUTOR");
        when(jwtService.extractTutorId(token)).thenReturn("tutor-123");

        boolean result = interceptor.preHandle(request, response, new Object());

        assertTrue(result);
        verify(request).setAttribute("tutorId", "tutor-123");
        verify(response, never()).sendError(anyInt(), anyString());
    }
}
