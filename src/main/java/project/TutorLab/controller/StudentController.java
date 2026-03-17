package project.TutorLab.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.dto.StudentCardDto;
import project.TutorLab.dto.StudentCreateDto;
import project.TutorLab.dto.StudentResponseDto;
import project.TutorLab.service.StudentService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/students")
@CrossOrigin(origins = "*")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @PostMapping("/tutor/{tutorId}")
    public ResponseEntity<StudentResponseDto> createStudent(
            @PathVariable String tutorId,
            @RequestBody StudentCreateDto createDto) {
        try {
            StudentResponseDto response = studentService.createStudent(tutorId, createDto);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudentResponseDto> getStudent(@PathVariable String id) {
        StudentResponseDto student = studentService.getStudentById(id);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(student);
    }

    @GetMapping("/tutor/{tutorId}")
    public ResponseEntity<List<StudentCardDto>> getAllStudentsByTutor(@PathVariable String tutorId) {
        List<StudentCardDto> students = studentService.getAllStudentsByTutorId(tutorId);
        return ResponseEntity.ok(students);
    }

    @PostMapping("/{id}/materials")
    public ResponseEntity<StudentResponseDto> addMaterial(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {
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
            @RequestBody Map<String, String> request) {
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
            @RequestBody Map<String, String> request) {
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
    public ResponseEntity<Void> deleteStudent(@PathVariable String id) {
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
            @RequestBody Map<String, String> request) {
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

    @PostMapping("/{id}/toggle-favorite")
    public ResponseEntity<Void> toggleFavoriteStudent(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {
        try {
            String tutorId = request.get("tutorId");
            if (tutorId == null || tutorId.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            studentService.toggleFavoriteStudent(tutorId, id);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/price")
    public ResponseEntity<StudentResponseDto> updatePrice(
            @PathVariable String id,
            @RequestBody Map<String, Object> request) {
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

    @PostMapping("/{id}/lessons/{date}/payment")
    public ResponseEntity<Void> updatePaymentStatus(
            @PathVariable String id,
            @PathVariable String date,
            @RequestBody Map<String, String> request) {
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

