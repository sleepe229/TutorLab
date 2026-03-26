package project.TutorLab.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.config.JwtService;
import project.TutorLab.dto.StudentCardDto;
import project.TutorLab.dto.StudentCreateDto;
import project.TutorLab.dto.StudentResponseDto;
import project.TutorLab.dto.StudentUpdateDto;
import project.TutorLab.model.ProgressNote;
import project.TutorLab.service.StudentService;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;
    private final JwtService jwtService;

    public StudentController(StudentService studentService, JwtService jwtService) {
        this.studentService = studentService;
        this.jwtService = jwtService;
    }

    /** Verify the authenticated tutor owns the given student. Returns 404 if student not found, 403 if not owned. */
    private ResponseEntity<Void> checkStudentOwnership(String studentId, HttpServletRequest request) {
        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        StudentResponseDto student = studentService.getStudentById(studentId);
        if (student == null) return ResponseEntity.notFound().build();
        if (!authenticatedTutorId.equals(student.getTutorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return null; // OK
    }

    @PostMapping("/tutor/{tutorId}")
    public ResponseEntity<StudentResponseDto> createStudent(
            @PathVariable String tutorId,
            @RequestBody StudentCreateDto createDto,
            HttpServletRequest request) {
        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        if (!authenticatedTutorId.equals(tutorId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            StudentResponseDto response = studentService.createStudent(tutorId, createDto);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudentResponseDto> getStudent(@PathVariable String id,
                                                         HttpServletRequest request) {
        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        StudentResponseDto student = studentService.getStudentById(id);
        if (student == null) return ResponseEntity.notFound().build();
        if (!authenticatedTutorId.equals(student.getTutorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(student);
    }

    @GetMapping("/tutor/{tutorId}")
    public ResponseEntity<List<StudentCardDto>> getAllStudentsByTutor(@PathVariable String tutorId,
                                                                      HttpServletRequest request) {
        String authenticatedTutorId = (String) request.getAttribute("tutorId");
        if (!authenticatedTutorId.equals(tutorId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        List<StudentCardDto> students = studentService.getAllStudentsByTutorId(tutorId);
        return ResponseEntity.ok(students);
    }

    @PostMapping("/{id}/materials")
    public ResponseEntity<StudentResponseDto> addMaterial(
            @PathVariable String id,
            @RequestBody Map<String, String> request,
            HttpServletRequest servletRequest) {
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, servletRequest);
        if (ownershipCheck != null) return ownershipCheck.hasBody()
                ? ResponseEntity.status(ownershipCheck.getStatusCode()).build()
                : ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            String materialUrl = request.get("materialUrl");
            if (materialUrl == null || materialUrl.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            StudentResponseDto response = studentService.addMaterial(id, materialUrl);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}/lessons")
    public ResponseEntity<StudentResponseDto> updateLessonDate(
            @PathVariable String id,
            @RequestBody Map<String, String> request,
            HttpServletRequest servletRequest) {
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, servletRequest);
        if (ownershipCheck != null) return ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            String oldLessonDate = request.get("oldLessonDate");
            String newLessonDate = request.get("newLessonDate");
            if (oldLessonDate == null || newLessonDate == null) {
                return ResponseEntity.badRequest().build();
            }
            StudentResponseDto response = studentService.updateLessonDate(id, oldLessonDate, newLessonDate);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/lessons")
    public ResponseEntity<StudentResponseDto> addLessonDate(
            @PathVariable String id,
            @RequestBody Map<String, String> request,
            HttpServletRequest servletRequest) {
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, servletRequest);
        if (ownershipCheck != null) return ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            String lessonDate = request.get("lessonDate");
            if (lessonDate == null || lessonDate.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            StudentResponseDto response = studentService.addLessonDate(id, lessonDate);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStudent(@PathVariable String id,
                                              HttpServletRequest request) {
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, request);
        if (ownershipCheck != null) return ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            studentService.deleteStudent(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** Public endpoint — no auth required. Student views their own data via UUID link. */
    @GetMapping("/{id}/view")
    public ResponseEntity<StudentResponseDto> getStudentPublic(@PathVariable String id) {
        StudentResponseDto student = studentService.getStudentById(id);
        if (student == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(student);
    }

    @PostMapping("/{id}/lesson-materials")
    public ResponseEntity<StudentResponseDto> addLessonMaterial(
            @PathVariable String id,
            @RequestBody Map<String, String> request,
            HttpServletRequest servletRequest) {
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, servletRequest);
        if (ownershipCheck != null) return ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            String lessonDate = request.get("lessonDate");
            String materialUrl = request.get("materialUrl");
            if (lessonDate == null || materialUrl == null || lessonDate.isEmpty() || materialUrl.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            StudentResponseDto response = studentService.addLessonMaterial(id, lessonDate, materialUrl);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}/info")
    public ResponseEntity<StudentResponseDto> updateStudentInfo(
            @PathVariable String id,
            @RequestBody StudentUpdateDto dto,
            HttpServletRequest servletRequest) {
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, servletRequest);
        if (ownershipCheck != null) return ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            return ResponseEntity.ok(studentService.updateStudentInfo(id, dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/toggle-favorite")
    public ResponseEntity<Void> toggleFavoriteStudent(
            @PathVariable String id,
            HttpServletRequest request) {
        // Use authenticated tutorId from JWT — do not trust body
        String tutorId = (String) request.getAttribute("tutorId");
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, request);
        if (ownershipCheck != null) return ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            studentService.toggleFavoriteStudent(tutorId, id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/price")
    public ResponseEntity<StudentResponseDto> updatePrice(
            @PathVariable String id,
            @RequestBody Map<String, Object> request,
            HttpServletRequest servletRequest) {
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, servletRequest);
        if (ownershipCheck != null) return ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            Integer price = request.get("pricePerLesson") != null
                    ? ((Number) request.get("pricePerLesson")).intValue()
                    : null;
            int trialCount = request.get("trialLessonsCount") != null
                    ? ((Number) request.get("trialLessonsCount")).intValue()
                    : 1;
            StudentResponseDto response = studentService.updatePrice(id, price, trialCount);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Dual-auth endpoint: accepts either tutor (X-Session-Token) or student (X-Student-Token).
     * Excluded from AuthInterceptor — auth is validated here.
     * POST: requires tutor auth. GET: requires either tutor or student auth.
     */
    @PostMapping("/{id}/progress-notes")
    public ResponseEntity<?> addProgressNote(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            jakarta.servlet.http.HttpServletRequest request) {

        String sessionToken = request.getHeader("X-Session-Token");
        if (sessionToken == null || !jwtService.isTokenValid(sessionToken)
                || !"TUTOR".equals(jwtService.extractRole(sessionToken))) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Verify the tutor owns this student
        String authenticatedTutorId = jwtService.extractTutorId(sessionToken);
        StudentResponseDto student = studentService.getStudentById(id);
        if (student == null) return ResponseEntity.notFound().build();
        if (!authenticatedTutorId.equals(student.getTutorId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        try {
            ProgressNote note = new ProgressNote();
            note.setSnapshotId(body.get("snapshotId") instanceof String s ? s : null);
            note.setNoteText(body.get("noteText") instanceof String s ? s : "");
            note.setRating(body.get("rating") instanceof Number n ? n.intValue() : 3);
            if (body.get("skillTags") instanceof List<?> tags) {
                note.setSkillTags(tags.stream().map(Object::toString).toList());
            }
            ProgressNote saved = studentService.addProgressNote(id, note);
            return ResponseEntity.ok(Map.of("noteId", saved.getId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/progress-notes")
    public ResponseEntity<?> getProgressNotes(
            @PathVariable String id,
            jakarta.servlet.http.HttpServletRequest request) {

        // Accept either tutor token or student token
        String sessionToken = request.getHeader("X-Session-Token");
        String studentToken = request.getHeader("X-Student-Token");
        boolean hasTutorAuth = sessionToken != null && jwtService.isTokenValid(sessionToken);
        boolean hasStudentAuth = studentToken != null && jwtService.isStudentToken(studentToken);

        if (!hasTutorAuth && !hasStudentAuth) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            List<ProgressNote> notes = studentService.getProgressNotes(id);
            return ResponseEntity.ok(notes);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/lessons/{date}/payment")
    public ResponseEntity<Void> updatePaymentStatus(
            @PathVariable String id,
            @PathVariable String date,
            @RequestBody Map<String, String> request,
            HttpServletRequest servletRequest) {
        ResponseEntity<Void> ownershipCheck = checkStudentOwnership(id, servletRequest);
        if (ownershipCheck != null) return ResponseEntity.status(ownershipCheck.getStatusCode()).build();
        try {
            String status = request.get("status");
            if (status == null || status.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            studentService.updateLessonPayment(id, date, status);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}

