package project.TutorLab.controller;

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
import project.TutorLab.model.live.LiveSessionState;
import project.TutorLab.service.LiveSessionService;
import project.TutorLab.service.PdfService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/live")
@CrossOrigin(origins = "*")
public class LiveSessionController {

    private static final Logger log = LoggerFactory.getLogger(LiveSessionController.class);

    private final LiveSessionService liveSessionService;

    private final LiveSessionWsController wsController;

    private final PdfService pdfService;

    @Value("${app.upload.dir:users-photos}")
    private String uploadDir;

    public LiveSessionController(LiveSessionService liveSessionService, LiveSessionWsController wsController, PdfService pdfService) {
        this.liveSessionService = liveSessionService;
        this.wsController = wsController;
        this.pdfService = pdfService;
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
    public ResponseEntity<LiveSessionSummary> getSessionByTutor(@PathVariable String tutorId) {
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
            @RequestParam("file") MultipartFile file) throws IOException {

        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            return ResponseEntity.badRequest().build();
        }

        LiveSessionState session = liveSessionService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
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
            @RequestParam int slideIndex
    ) {
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

    @PostMapping("/sessions/{sessionId}/clear-drawings")
    public ResponseEntity<Void> clearDrawings(
            @PathVariable String sessionId,
            @RequestParam int slideIndex
    ) {
        liveSessionService.clearSlideDrawings(sessionId, slideIndex);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> deleteSession(@PathVariable String sessionId) {
        LiveSessionState session = liveSessionService.getSession(sessionId);
        liveSessionService.deleteSession(sessionId);
        if (session != null) wsController.notifyTutorLiveEnded(session.getTutorId());
        return ResponseEntity.ok().build();
    }
}
