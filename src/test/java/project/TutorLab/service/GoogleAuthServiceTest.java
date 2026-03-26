package project.TutorLab.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GoogleAuthServiceTest {

    private GoogleAuthService service;
    private RestTemplate restTemplate;

    @BeforeEach
    void setUp() {
        service = new GoogleAuthService();
        restTemplate = mock(RestTemplate.class);
        ReflectionTestUtils.setField(service, "restTemplate", restTemplate);
    }

    // ── isEnabled ─────────────────────────────────────────────────────────────

    @Test
    void isEnabled_withClientId_returnsTrue() {
        ReflectionTestUtils.setField(service, "clientId", "my-client-id.apps.googleusercontent.com");
        assertTrue(service.isEnabled());
    }

    @Test
    void isEnabled_withEmptyClientId_returnsFalse() {
        ReflectionTestUtils.setField(service, "clientId", "");
        assertFalse(service.isEnabled());
    }

    @Test
    void isEnabled_withNullClientId_returnsFalse() {
        ReflectionTestUtils.setField(service, "clientId", null);
        assertFalse(service.isEnabled());
    }

    // ── verify ────────────────────────────────────────────────────────────────

    @Test
    void verify_validToken_returnsGoogleUserInfo() {
        ReflectionTestUtils.setField(service, "clientId", "client-id");

        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", "google-sub-123");
        claims.put("email", "Alice@Gmail.com");
        claims.put("email_verified", true);
        claims.put("given_name", "Alice");
        claims.put("family_name", "Smith");
        claims.put("name", "Alice Smith");
        claims.put("picture", "https://pic.example.com/photo.jpg");

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(claims));

        GoogleAuthService.GoogleUserInfo info = service.verify("valid-token");

        assertEquals("google-sub-123", info.sub());
        assertEquals("alice@gmail.com", info.email()); // lowercased
        assertEquals("Alice", info.firstName());
        assertEquals("Smith", info.lastName());
        assertEquals("Alice Smith", info.fullName());
        assertEquals("https://pic.example.com/photo.jpg", info.pictureUrl());
    }

    @Test
    void verify_invalidToken_throwsUnauthorized() {
        ReflectionTestUtils.setField(service, "clientId", "client-id");

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenThrow(new HttpClientErrorException(HttpStatus.UNAUTHORIZED));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.verify("bad-token"));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void verify_googleReturnsNoSub_throwsUnauthorized() {
        ReflectionTestUtils.setField(service, "clientId", "client-id");

        Map<String, Object> claims = new HashMap<>();
        claims.put("email", "alice@gmail.com");
        claims.put("email_verified", true);
        // No "sub"

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(claims));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.verify("token"));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void verify_unverifiedEmail_throwsUnauthorized() {
        ReflectionTestUtils.setField(service, "clientId", "client-id");

        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", "sub-abc");
        claims.put("email", "alice@gmail.com");
        claims.put("email_verified", false);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(claims));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.verify("token"));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void verify_missingToken_throwsUnauthorized() {
        ReflectionTestUtils.setField(service, "clientId", "client-id");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.verify(null));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void verify_blankToken_throwsUnauthorized() {
        ReflectionTestUtils.setField(service, "clientId", "client-id");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.verify("   "));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void verify_googleDisabled_throwsServiceUnavailable() {
        ReflectionTestUtils.setField(service, "clientId", "");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.verify("any-token"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
    }

    @Test
    void verify_noGivenName_derivesFromFullName() {
        ReflectionTestUtils.setField(service, "clientId", "client-id");

        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", "sub-xyz");
        claims.put("email", "bob@gmail.com");
        claims.put("email_verified", true);
        claims.put("name", "Bob Jones");
        // no given_name / family_name fields

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(claims));

        GoogleAuthService.GoogleUserInfo info = service.verify("token");

        assertEquals("Bob", info.firstName());
        assertEquals("Jones", info.lastName());
    }
}
