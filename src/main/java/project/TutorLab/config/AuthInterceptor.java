package project.TutorLab.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuthInterceptor.class);

    private final JwtService jwtService;

    public AuthInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public boolean preHandle(@NonNull HttpServletRequest request,
                             @NonNull HttpServletResponse response,
                             @NonNull Object handler) throws Exception {
        String token = request.getHeader("X-Session-Token");
        if (token == null || token.isBlank()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing authentication token");
            return false;
        }

        if (!jwtService.isTokenValid(token)) {
            log.warn("Rejected invalid/expired token from {}", request.getRemoteAddr());
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired token");
            return false;
        }

        // Reject student tokens on tutor-protected routes
        if (!"TUTOR".equals(jwtService.extractRole(token))) {
            log.warn("Rejected non-TUTOR token on protected route {} from {}", request.getRequestURI(), request.getRemoteAddr());
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Tutor role required");
            return false;
        }

        String tutorId = jwtService.extractTutorId(token);
        request.setAttribute("tutorId", tutorId);
        return true;
    }
}