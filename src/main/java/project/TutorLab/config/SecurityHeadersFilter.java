package project.TutorLab.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Adds security-related HTTP response headers to every request.
 * Prevents clickjacking, MIME-sniffing, and restricts resource loading.
 */
@Component
public class SecurityHeadersFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Prevent MIME type sniffing
        httpResponse.setHeader("X-Content-Type-Options", "nosniff");

        // Prevent clickjacking
        httpResponse.setHeader("X-Frame-Options", "DENY");

        // Modern browsers ignore this, but set to 0 to disable legacy XSS filter
        httpResponse.setHeader("X-XSS-Protection", "0");

        // Control referrer information
        httpResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

        // Restrict powerful browser features — camera=(self) required for WebRTC video
        httpResponse.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");

        // Content Security Policy
        httpResponse.setHeader("Content-Security-Policy",
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline'; " +
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "font-src 'self' https://fonts.gstatic.com; " +
                "img-src 'self' data: blob:; " +
                "connect-src 'self' wss://tutorlab.onrender.com https://api.anthropic.com https://fonts.googleapis.com https://fonts.gstatic.com;");

        // HSTS: enforce HTTPS for 2 years (required on Render where nginx is not in the path)
        httpResponse.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

        chain.doFilter(request, response);
    }
}