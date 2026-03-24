package project.TutorLab.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import project.TutorLab.config.JwtService;
import project.TutorLab.model.LessonRecap;
import project.TutorLab.model.SessionSnapshot;
import project.TutorLab.model.Student;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.model.live.LiveSessionState;
import project.TutorLab.repository.LessonRecapRepository;
import project.TutorLab.repository.SessionSnapshotRepository;
import project.TutorLab.repository.StudentRepository;
import project.TutorLab.service.LiveSessionService;
import project.TutorLab.service.PdfService;
import project.TutorLab.service.RecapService;
import project.TutorLab.service.StudentAccountService;
import project.TutorLab.service.StudentService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/live")
public class LiveSessionController {

    private static final Logger log = LoggerFactory.getLogger(LiveSessionController.class);

    private final LiveSessionService liveSessionService;
    private final LiveSessionWsController wsController;
    private final PdfService pdfService;
    private final JwtService jwtService;
    private final StudentAccountService studentAccountService;
    private final StudentService studentService;
    private final SessionSnapshotRepository sessionSnapshotRepository;
    private final LessonRecapRepository lessonRecapRepository;
    private final StudentRepository studentRepository;
    private final RecapService recapService;
    private final ObjectMapper objectMapper;

    @Value("${app.upload.dir:users-photos}")
    private String uploadDir;

    public LiveSessionController(LiveSessionService liveSessionService, LiveSessionWsController wsController,
                                 PdfService pdfService, JwtService jwtService,
                                 StudentAccountService studentAccountService, StudentService studentService,
                                 SessionSnapshotRepository sessionSnapshotRepository,
                                 LessonRecapRepository lessonRecapRepository,
                                 StudentRepository studentRepository,
                                 RecapService recapService,
                                 ObjectMapper objectMapper) {
        this.liveSessionService = liveSessionService;
        this.wsController = wsController;
        this.pdfService = pdfService;
        this.jwtService = jwtService;
        this.studentAccountService = studentAccountService;
        this.studentService = studentService;
        this.sessionSnapshotRepository = sessionSnapshotRepository;
        this.lessonRecapRepository = lessonRecapRepository;
        this.studentRepository = studentRepository;
        this.recapService = recapService;
        this.objectMapper = objectMapper;
    }

    public record LiveSessionSummary(boolean active, String sessionId) {
    }

    @PostMapping("/sessions")
    public ResponseEntity<LiveSessionState> createSession(
            @RequestParam String tutorId,
            @RequestParam(required = false, defaultValue = "Новый урок") String title,
            jakarta.servlet.http.HttpServletRequest request
    ) {
        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        if (authenticatedTutorId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!authenticatedTutorId.equals(tutorId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        LiveSessionState state = liveSessionService.createSession(authenticatedTutorId, title);
        wsController.notifyTutorLive(authenticatedTutorId, state.getSessionId());
        return ResponseEntity.ok(state);
    }

    @GetMapping("/sessions/tutor/{tutorId}")
    public ResponseEntity<LiveSessionSummary> getSessionByTutor(
            @PathVariable String tutorId,
            jakarta.servlet.http.HttpServletRequest request) {
        String studentToken = request.getHeader("X-Student-Token");
        if (studentToken == null || !jwtService.isStudentToken(studentToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // Verify the student account has at least one student profile linked to this tutor
        String studentAccountId = jwtService.extractSubject(studentToken);
        StudentAccount account = studentAccountService.getById(studentAccountId);
        if (account == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        List<String> linkedStudentIds = account.getLinkedStudentIds();
        if (linkedStudentIds == null || linkedStudentIds.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        boolean isLinked = studentService.hasAnyStudentWithTutor(linkedStudentIds, tutorId);
        if (!isLinked) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        LiveSessionState state = liveSessionService.getSessionByTutor(tutorId);
        if (state == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(new LiveSessionSummary(true, state.getSessionId()));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<LiveSessionState> getSession(@PathVariable String sessionId) {
        LiveSessionState state = liveSessionService.getSession(sessionId);
        if (state == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(state);
    }

    @PostMapping("/sessions/{sessionId}/presentation")
    public ResponseEntity<Void> uploadPresentation(
            @PathVariable String sessionId,
            @RequestParam("file") MultipartFile file,
            jakarta.servlet.http.HttpServletRequest request) throws IOException {

        // This path is excluded from AuthInterceptor (so GET stays public for students).
        // POST must validate the tutor token manually.
        String token = request.getHeader("X-Session-Token");
        if (token == null || !jwtService.isTokenValid(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!"TUTOR".equals(jwtService.extractRole(token))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String authenticatedTutorId = jwtService.extractTutorId(token);

        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            return ResponseEntity.badRequest().build();
        }

        LiveSessionState session = liveSessionService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }

        if (!authenticatedTutorId.equals(session.getTutorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        byte[] pdfBytes = file.getBytes();

        pdfService.convertPdfToImagesAsync(pdfBytes, sessionId).thenAccept(slideUrls -> {
            LiveSessionState s = liveSessionService.getSession(sessionId);
            if (s != null) {
                s.setSlideUrls(slideUrls);
                s.setCurrentSlideIndex(0);
                liveSessionService.updateSession(s);
            }
            wsController.notifyPresentationLoaded(sessionId, slideUrls);
        });

        return ResponseEntity.accepted().build();
    }

    @GetMapping("/sessions/{sessionId}/presentation")
    public ResponseEntity<Map<String, Object>> getPresentation(@PathVariable String sessionId) {
        LiveSessionState session = liveSessionService.getSession(sessionId);
        if (session == null || session.getSlideUrls().isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(Map.of(
                "slides", session.getSlideUrls(),
                "currentSlide", session.getCurrentSlideIndex()
        ));
    }

    @PutMapping("/sessions/{sessionId}/slide")
    public ResponseEntity<Void> changeSlide(
            @PathVariable String sessionId,
            @RequestParam int slideIndex,
            jakarta.servlet.http.HttpServletRequest request
    ) {
        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        if (authenticatedTutorId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        LiveSessionState session = liveSessionService.getSession(sessionId);
        if (session == null) return ResponseEntity.notFound().build();
        if (!authenticatedTutorId.equals(session.getTutorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        liveSessionService.updateSlide(sessionId, slideIndex);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/sessions/{sessionId}/slides/{slideIndex}/drawings")
    public ResponseEntity<List<LiveSessionState.DrawPath>> getSlideDrawings(
            @PathVariable String sessionId,
            @PathVariable int slideIndex
    ) {
        LiveSessionState session = liveSessionService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }

        List<LiveSessionState.DrawPath> drawings = session.getSlideDrawings()
                .getOrDefault(slideIndex, new ArrayList<>());

        return ResponseEntity.ok(drawings);
    }


    @GetMapping("/slides/{sessionId}/{filename:.+}")
    public ResponseEntity<Resource> getSlide(
            @PathVariable String sessionId,
            @PathVariable String filename
    ) {
        // Path traversal protection: reject any path component containing ".." or "/"
        if (sessionId.contains("..") || sessionId.contains("/") || sessionId.contains("\\")
                || filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            log.warn("Path traversal attempt detected: sessionId={}, filename={}", sessionId, filename);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        try {
            Path basePath = Paths.get(uploadDir, "slides").toAbsolutePath().normalize();
            Path filePath = basePath.resolve(sessionId).resolve(filename).normalize();

            // Verify the resolved path is strictly inside the slides base directory
            if (!filePath.startsWith(basePath)) {
                log.warn("Resolved path escaped base dir: {}", filePath);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = "image/png";
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (Exception e) {
            log.error("Error serving slide: sessionId={}, filename={}", sessionId, filename, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Ends a live session and creates an immutable SessionSnapshot.
     *
     * Governance:
     *  - Idempotent: repeated calls with same sessionId return the existing snapshotId.
     *  - Snapshot is immutable after creation — never modified.
     *  - slideDrawings deep-copied via ObjectMapper to prevent shared references.
     *  - Recap generated asynchronously (does not block this response).
     *  - Live session is deleted after snapshot is committed.
     */
    @PostMapping("/sessions/{sessionId}/end")
    public ResponseEntity<Map<String, Object>> endSession(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, String> body,
            jakarta.servlet.http.HttpServletRequest request) {

        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        if (authenticatedTutorId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        LiveSessionState session = liveSessionService.getSession(sessionId);
        if (session == null) return ResponseEntity.notFound().build();
        if (!authenticatedTutorId.equals(session.getTutorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // Idempotency check: if snapshot already exists for this sessionId, return it
        String existingSnapshotId = sessionSnapshotRepository.findSnapshotIdBySessionId(sessionId);
        if (existingSnapshotId != null) {
            log.info("Idempotent end: snapshot {} already exists for session {}", existingSnapshotId, sessionId);
            return ResponseEntity.ok(Map.of("snapshotId", existingSnapshotId, "recapQueued", false));
        }

        String linkedStudentId = body != null ? body.get("studentId") : null;
        Student linkedStudent = null;
        if (linkedStudentId != null && !linkedStudentId.isBlank()) {
            linkedStudent = studentRepository.findById(linkedStudentId);
            if (linkedStudent == null || !authenticatedTutorId.equals(linkedStudent.getTutorId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Student not found or not owned by this tutor"));
            }
        }

        // Build immutable snapshot — deep-copy drawings via ObjectMapper
        SessionSnapshot snapshot = new SessionSnapshot();
        snapshot.setId(UUID.randomUUID().toString());
        snapshot.setSessionId(sessionId);
        snapshot.setTutorId(authenticatedTutorId);
        snapshot.setTitle(session.getTitle());
        snapshot.setStartedAt(session.getStartedAt());
        snapshot.setEndedAt(LocalDateTime.now());

        if (session.getStartedAt() != null) {
            snapshot.setDurationMinutes((int) ChronoUnit.MINUTES.between(session.getStartedAt(), snapshot.getEndedAt()));
        }

        // Deep-copy slideUrls (defensive copy)
        snapshot.setSlideUrls(session.getSlideUrls() != null ? new ArrayList<>(session.getSlideUrls()) : new ArrayList<>());

        // Deep-copy slideDrawings via serialization round-trip to prevent shared object references
        try {
            @SuppressWarnings("unchecked")
            Map<Integer, List<LiveSessionState.DrawPath>> drawingsCopy = objectMapper.convertValue(
                    session.getSlideDrawings(),
                    objectMapper.getTypeFactory().constructMapType(
                            HashMap.class,
                            objectMapper.getTypeFactory().constructType(Integer.class),
                            objectMapper.getTypeFactory().constructCollectionType(List.class, LiveSessionState.DrawPath.class)
                    )
            );
            snapshot.setSlideDrawings(drawingsCopy);
        } catch (Exception e) {
            log.warn("Could not deep-copy drawings for session {}, using empty map: {}", sessionId, e.getMessage());
            snapshot.setSlideDrawings(new HashMap<>());
        }

        if (linkedStudent != null) {
            snapshot.setStudentId(linkedStudentId);
            snapshot.setStudentFirstName(linkedStudent.getFirstName());
            snapshot.setStudentLastName(linkedStudent.getLastName());
        }

        // Commit immutable snapshot BEFORE deleting live session
        sessionSnapshotRepository.save(snapshot);
        log.info("Snapshot {} created for session {} (tutor={})", snapshot.getId(), sessionId, authenticatedTutorId);

        // Delete ephemeral live session
        liveSessionService.deleteSession(sessionId);
        wsController.notifyTutorLiveEnded(authenticatedTutorId);

        // Fire-and-forget async recap (non-blocking, retry-safe)
        recapService.generateRecapAsync(snapshot);

        return ResponseEntity.ok(Map.of("snapshotId", snapshot.getId(), "recapQueued", true));
    }

    /**
     * Returns a LessonRecap by snapshotId.
     * Public endpoint (no auth) — snapshotId is a UUID, unguessable.
     * Returns 404 if recap is not yet generated.
     */
    @GetMapping("/recap/{snapshotId}")
    public ResponseEntity<LessonRecap> getRecap(@PathVariable String snapshotId) {
        LessonRecap recap = lessonRecapRepository.findBySnapshotId(snapshotId);
        if (recap == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(recap);
    }

    @PostMapping("/sessions/{sessionId}/clear-drawings")
    public ResponseEntity<Void> clearDrawings(
            @PathVariable String sessionId,
            @RequestParam int slideIndex,
            jakarta.servlet.http.HttpServletRequest request
    ) {
        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        if (authenticatedTutorId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        LiveSessionState session = liveSessionService.getSession(sessionId);
        if (session == null) return ResponseEntity.notFound().build();
        if (!authenticatedTutorId.equals(session.getTutorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        liveSessionService.clearSlideDrawings(sessionId, slideIndex);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> deleteSession(
            @PathVariable String sessionId,
            jakarta.servlet.http.HttpServletRequest request) {
        String token = request.getHeader("X-Session-Token");
        if (token == null || !jwtService.isTokenValid(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Ensure that only TUTOR-role tokens are allowed to delete sessions
        String role = jwtService.extractRole(token);
        if (!"TUTOR".equals(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        LiveSessionState session = liveSessionService.getSession(sessionId);
        if (session == null) return ResponseEntity.notFound().build();
        if (!session.getTutorId().equals(jwtService.extractTutorId(token))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        liveSessionService.deleteSession(sessionId);
        wsController.notifyTutorLiveEnded(session.getTutorId());
        return ResponseEntity.ok().build();
    }
}
