package project.TutorLab.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.dto.TutorLoginDto;
import project.TutorLab.dto.TutorRegistrationDto;
import project.TutorLab.dto.TutorResponseDto;
import project.TutorLab.dto.TutorUpdateDto;
import project.TutorLab.service.AuthRateLimiter;
import project.TutorLab.service.TutorService;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/api/tutors")
public class TutorController {

    private final TutorService tutorService;
    private final AuthRateLimiter authRateLimiter;

    public TutorController(TutorService tutorService, AuthRateLimiter authRateLimiter) {
        this.tutorService = tutorService;
        this.authRateLimiter = authRateLimiter;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerTutor(@RequestBody TutorRegistrationDto registrationDto,
                                           HttpServletRequest request) {
        authRateLimiter.checkRegisterLimit(request);
        try {
            TutorResponseDto response = tutorService.registerTutor(registrationDto);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(java.util.Map.of("error", e.getReason() != null ? e.getReason() : "Registration failed"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginTutor(@RequestBody TutorLoginDto loginDto,
                                        HttpServletRequest request) {
        authRateLimiter.checkLoginLimit(request);
        try {
            TutorResponseDto response = tutorService.loginTutor(loginDto);
            return ResponseEntity.ok(response);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(java.util.Map.of("error", e.getReason() != null ? e.getReason() : "Login failed"));
        }
    }

    @PostMapping("/auth/google")
    public ResponseEntity<?> googleAuth(@RequestBody java.util.Map<String, String> body) {
        String accessToken = body.get("accessToken");
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "accessToken is required"));
        }
        try {
            TutorResponseDto response = tutorService.googleAuth(accessToken);
            return ResponseEntity.ok(response);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                .body(java.util.Map.of("error", e.getReason() != null ? e.getReason() : "Google auth failed"));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<TutorResponseDto> getTutor(@PathVariable String id) {
        TutorResponseDto tutor = tutorService.getTutorById(id);
        if (tutor == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(tutor);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTutor(@PathVariable String id,
                                         @RequestBody TutorUpdateDto updateDto,
                                         HttpServletRequest request) {
        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        if (authenticatedTutorId == null || !authenticatedTutorId.equals(id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(java.util.Map.of("error", "Cannot modify another tutor's profile"));
        }
        try {
            TutorResponseDto response = tutorService.updateTutor(id, updateDto);
            return ResponseEntity.ok(response);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(java.util.Map.of("error", e.getReason() != null ? e.getReason() : "Update failed"));
        }
    }

    @GetMapping("/{id}/exists")
    public ResponseEntity<Boolean> tutorExists(@PathVariable String id) {
        boolean exists = tutorService.tutorExists(id);
        return ResponseEntity.ok(exists);
    }

    @GetMapping("/login/{login}/exists")
    public ResponseEntity<Boolean> loginExists(@PathVariable String login) {
        boolean exists = tutorService.loginExists(login);
        return ResponseEntity.ok(exists);
    }

    /** Public listing of tutors who opted into the marketplace. No auth required. */
    @GetMapping("/public")
    public ResponseEntity<List<TutorResponseDto>> getPublicTutors() {
        return ResponseEntity.ok(tutorService.getPublicTutors());
    }

    /** Public tutor profile — strips sensitive fields, works for any tutor ID */
    @GetMapping("/{id}/profile")
    public ResponseEntity<TutorResponseDto> getTutorPublicProfile(@PathVariable String id) {
        TutorResponseDto dto = tutorService.getTutorById(id);
        if (dto == null) return ResponseEntity.notFound().build();
        dto.setLogin(null);
        dto.setStudentIds(null);
        dto.setSessionToken(null);
        dto.setRefreshToken(null);
        return ResponseEntity.ok(dto);
    }
}

