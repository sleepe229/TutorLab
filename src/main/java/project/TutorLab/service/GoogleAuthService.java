package project.TutorLab.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Verifies Google OAuth 2.0 access tokens via Google's userinfo endpoint.
 * Called after the frontend receives an access_token via useGoogleLogin (implicit flow).
 */
@Service
public class GoogleAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleAuthService.class);
    private static final String USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

    @Value("${app.google.client-id:}")
    private String clientId;

    private final RestTemplate restTemplate = new RestTemplate();

    public boolean isEnabled() {
        return clientId != null && !clientId.isBlank();
    }

    public record GoogleUserInfo(
        String sub,
        String email,
        String firstName,
        String lastName,
        String fullName,
        String pictureUrl
    ) {}

    /**
     * Verifies a Google access token and returns user profile info.
     *
     * @throws ResponseStatusException 401 if the token is invalid or rejected by Google
     * @throws ResponseStatusException 503 if Google OAuth is not configured
     */
    @SuppressWarnings("unchecked")
    public GoogleUserInfo verify(String accessToken) {
        if (!isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Google OAuth is not configured on this server");
        }
        if (accessToken == null || accessToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing Google access token");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        Map<String, Object> claims;
        try {
            ResponseEntity<Map> resp = restTemplate.exchange(
                USERINFO_URL, HttpMethod.GET, entity, Map.class);
            claims = resp.getBody();
        } catch (HttpClientErrorException e) {
            log.warn("Google userinfo rejected token: status={}", e.getStatusCode());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google token");
        } catch (Exception e) {
            log.error("Google userinfo call failed", e);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google authentication failed");
        }

        if (claims == null || claims.get("sub") == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google token response");
        }

        // email_verified can be boolean or string depending on token type
        Object emailVerified = claims.get("email_verified");
        if (!Boolean.TRUE.equals(emailVerified) && !"true".equalsIgnoreCase(String.valueOf(emailVerified))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google email is not verified");
        }

        String givenName = (String) claims.get("given_name");
        String familyName = (String) claims.get("family_name");
        String name = (String) claims.get("name");
        String email = claims.get("email") != null
            ? ((String) claims.get("email")).toLowerCase() : null;

        // Fallback: derive given/family from full name
        if (givenName == null && name != null) {
            String[] parts = name.trim().split("\\s+", 2);
            givenName = parts[0];
            familyName = parts.length > 1 ? parts[1] : null;
        }
        if (name == null) {
            name = ((givenName != null ? givenName : "") + " " + (familyName != null ? familyName : "")).trim();
        }

        return new GoogleUserInfo(
            (String) claims.get("sub"),
            email,
            givenName,
            familyName,
            name,
            (String) claims.get("picture")
        );
    }
}
