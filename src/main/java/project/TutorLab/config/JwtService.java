package project.TutorLab.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.access-ttl-minutes:15}")
    private long accessTtlMinutes;

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(String tutorId) {
        return Jwts.builder()
                .setSubject(tutorId)
                .claim("role", "TUTOR")
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + accessTtlMinutes * 60 * 1000L))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String generateStudentToken(String studentAccountId) {
        return Jwts.builder()
                .setSubject(studentAccountId)
                .claim("role", "STUDENT")
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + accessTtlMinutes * 60 * 1000L))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractTutorId(String token) {
        return getClaims(token).getSubject();
    }

    /** Returns the JWT subject regardless of role (tutorId for TUTOR tokens, studentAccountId for STUDENT tokens). */
    public String extractSubject(String token) {
        return getClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            getClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public boolean isStudentToken(String token) {
        try {
            Claims claims = getClaims(token);
            return "STUDENT".equals(claims.get("role", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}