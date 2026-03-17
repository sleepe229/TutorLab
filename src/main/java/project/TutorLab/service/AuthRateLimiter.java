package project.TutorLab.service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AuthRateLimiter {

    @Value("${app.rate-limit.login-attempts:5}")
    private int loginAttempts;

    @Value("${app.rate-limit.login-window-seconds:60}")
    private int loginWindowSeconds;

    @Value("${app.rate-limit.register-attempts:3}")
    private int registerAttempts;

    @Value("${app.rate-limit.register-window-seconds:300}")
    private int registerWindowSeconds;

    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> registerBuckets = new ConcurrentHashMap<>();

    public void checkLoginLimit(HttpServletRequest request) {
        String key = getClientKey(request);
        Bucket bucket = loginBuckets.computeIfAbsent(key, k ->
            Bucket.builder()
                .addLimit(Bandwidth.classic(loginAttempts,
                    Refill.intervally(loginAttempts, Duration.ofSeconds(loginWindowSeconds))))
                .build()
        );
        if (!bucket.tryConsume(1)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many login attempts. Try again in " + loginWindowSeconds + " seconds.");
        }
    }

    public void checkRegisterLimit(HttpServletRequest request) {
        String key = getClientKey(request);
        Bucket bucket = registerBuckets.computeIfAbsent(key, k ->
            Bucket.builder()
                .addLimit(Bandwidth.classic(registerAttempts,
                    Refill.intervally(registerAttempts, Duration.ofSeconds(registerWindowSeconds))))
                .build()
        );
        if (!bucket.tryConsume(1)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many registration attempts. Try again later.");
        }
    }

    private String getClientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded != null ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
    }
}
