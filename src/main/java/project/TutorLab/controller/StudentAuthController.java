package project.TutorLab.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.config.JwtService;
import project.TutorLab.dto.StudentSessionHistoryDto;
import project.TutorLab.model.LessonRecap;
import project.TutorLab.model.SessionSnapshot;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.repository.LessonRecapRepository;
import project.TutorLab.repository.SessionSnapshotRepository;
import project.TutorLab.service.AuthRateLimiter;
import project.TutorLab.service.StudentAccountService;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/students/auth")
@CrossOrigin(origins = "*")
public class StudentAuthController {

    @Autowired
    private StudentAccountService studentAccountService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuthRateLimiter authRateLimiter;

    @Autowired
    private SessionSnapshotRepository sessionSnapshotRepository;

    @Autowired
    private LessonRecapRepository lessonRecapRepository;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body, HttpServletRequest request) {
        authRateLimiter.checkRegisterLimit(request);
        String email = body.get("email");
        String password = body.get("password");
        String firstName = body.get("firstName");
        String lastName = body.get("lastName");
        String linkedStudentId = body.get("linkedStudentId");

        if (email == null || email.isBlank() || password == null || password.isBlank()
                || firstName == null || firstName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Required fields missing"));
        }
        try {
            Map<String, Object> result = studentAccountService.register(
                    email.trim(), password, firstName.trim(),
                    lastName != null ? lastName.trim() : "",
                    linkedStudentId);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        authRateLimiter.checkLoginLimit(request);
        String email = body.get("email");
        String password = body.get("password");
        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password required"));
        }
        try {
            return ResponseEntity.ok(studentAccountService.login(email.trim(), password));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid email or password"));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "refreshToken required"));
        }
        try {
            return ResponseEntity.ok(studentAccountService.refresh(refreshToken));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken != null) studentAccountService.logout(refreshToken);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe(
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader) {
        String accountId = extractAccountId(tokenHeader);
        if (accountId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        StudentAccount account = studentAccountService.getById(accountId);
        if (account == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
                "studentAccountId", account.getId(),
                "email", account.getEmail(),
                "firstName", account.getFirstName(),
                "lastName", account.getLastName() != null ? account.getLastName() : "",
                "linkedStudentIds", account.getLinkedStudentIds()
        ));
    }

    @PostMapping("/link")
    public ResponseEntity<?> linkToStudent(
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader,
            @RequestBody Map<String, String> body) {
        String accountId = extractAccountId(tokenHeader);
        if (accountId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String studentId = body.get("studentId");
        if (studentId == null || studentId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "studentId required"));
        }
        try {
            studentAccountService.linkToStudent(accountId, studentId);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Returns lesson history for all linked student profiles. */
    @GetMapping("/history")
    public ResponseEntity<?> getHistory(
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader) {
        String accountId = extractAccountId(tokenHeader);
        if (accountId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        List<StudentSessionHistoryDto> history = studentAccountService.getStudentHistory(accountId);
        return ResponseEntity.ok(history);
    }

    /** Returns the LessonRecap for a snapshot. Validates ownership. */
    @GetMapping("/snapshot/{snapshotId}/recap")
    public ResponseEntity<?> getSnapshotRecap(
            @PathVariable String snapshotId,
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader) {
        String accountId = extractAccountId(tokenHeader);
        if (accountId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        if (!isSnapshotOwnedByAccount(snapshotId, accountId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        LessonRecap recap = lessonRecapRepository.findBySnapshotId(snapshotId);
        if (recap == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(recap);
    }

    /** Returns slide URLs for a snapshot (for replay). Validates ownership. */
    @GetMapping("/snapshot/{snapshotId}/slides")
    public ResponseEntity<?> getSnapshotSlides(
            @PathVariable String snapshotId,
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader) {
        String accountId = extractAccountId(tokenHeader);
        if (accountId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        if (!isSnapshotOwnedByAccount(snapshotId, accountId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        SessionSnapshot snapshot = sessionSnapshotRepository.findById(snapshotId);
        if (snapshot == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(snapshot.getSlideUrls());
    }

    /**
     * Ownership check: snapshotId must belong to one of the account's linked student profiles.
     * Prevents cross-account data access.
     */
    private boolean isSnapshotOwnedByAccount(String snapshotId, String accountId) {
        StudentAccount account = studentAccountService.getById(accountId);
        if (account == null) return false;
        for (String studentId : account.getLinkedStudentIds()) {
            SessionSnapshot snap = sessionSnapshotRepository.findById(snapshotId);
            if (snap != null && studentId.equals(snap.getStudentId())) return true;
        }
        return false;
    }

    /** Decode JWT to extract the student account ID (JWT subject). */
    private String extractAccountId(String jwtToken) {
        if (jwtToken == null || jwtToken.isBlank()) return null;
        try {
            if (!jwtService.isTokenValid(jwtToken)) return null;
            return jwtService.extractTutorId(jwtToken); // subject extraction is role-agnostic
        } catch (Exception e) {
            return null;
        }
    }
}
