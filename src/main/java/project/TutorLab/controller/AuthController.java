package project.TutorLab.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import project.TutorLab.config.JwtService;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    /**
     * Exchange a valid refresh token for a new short-lived access token.
     */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "refreshToken is required");
        }

        String refreshKey = "refresh:" + refreshToken;
        Object tutorId = redisTemplate.opsForValue().get(refreshKey);
        if (tutorId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
        }

        // Rotate refresh token: delete old, issue new
        redisTemplate.delete(refreshKey);
        String newRefreshToken = java.util.UUID.randomUUID().toString();
        long refreshTtlDays = 30L;
        redisTemplate.opsForValue().set("refresh:" + newRefreshToken, tutorId.toString(),
                refreshTtlDays, java.util.concurrent.TimeUnit.DAYS);

        String newAccessToken = jwtService.generateAccessToken(tutorId.toString());
        log.debug("Issued new access+refresh tokens for tutor={}", tutorId);
        return ResponseEntity.ok(Map.of("accessToken", newAccessToken, "refreshToken", newRefreshToken));
    }

    /**
     * Invalidate refresh token on logout.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken != null && !refreshToken.isBlank()) {
            redisTemplate.delete("refresh:" + refreshToken);
            log.debug("Refresh token invalidated on logout");
        }
        return ResponseEntity.noContent().build();
    }
}