package project.TutorLab.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.config.JwtService;
import project.TutorLab.dto.StudentCreateDto;
import project.TutorLab.dto.StudentResponseDto;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.service.StudentAccountService;
import project.TutorLab.service.StudentService;

import java.util.Map;

/**
 * Allows a student account holder to join a tutor's class via their tutor link.
 * Creates a new tutor-owned Student record linked to the StudentAccount, then
 * links the StudentAccount back to that new student ID.
 *
 * POST /api/join/{tutorId}
 * Header: X-Student-Token: <student JWT>
 */
@RestController
@RequestMapping("/api/join")
public class JoinController {

    private static final Logger log = LoggerFactory.getLogger(JoinController.class);

    @Autowired
    private JwtService jwtService;

    @Autowired
    private StudentAccountService studentAccountService;

    @Autowired
    private StudentService studentService;

    @PostMapping("/{tutorId}")
    public ResponseEntity<?> joinAsTutor(
            @PathVariable String tutorId,
            @RequestHeader(value = "X-Student-Token", required = false) String tokenHeader) {

        // Validate student JWT
        if (tokenHeader == null || !jwtService.isTokenValid(tokenHeader)) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or missing student token"));
        }

        String studentAccountId = jwtService.extractTutorId(tokenHeader);
        StudentAccount account = studentAccountService.getById(studentAccountId);
        if (account == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Student account not found"));
        }

        // Prevent duplicate join: check if account already has a student profile linked to this tutor
        if (account.getLinkedStudentIds() != null) {
            boolean alreadyJoined = studentService.hasAnyStudentWithTutor(account.getLinkedStudentIds(), tutorId);
            if (alreadyJoined) {
                log.info("StudentAccount {} already joined tutor {}, skipping duplicate creation", studentAccountId, tutorId);
                // Find and return the existing studentId
                for (String sid : account.getLinkedStudentIds()) {
                    project.TutorLab.dto.StudentResponseDto existing = studentService.getStudentById(sid);
                    if (existing != null && tutorId.equals(existing.getTutorId())) {
                        return ResponseEntity.ok(Map.of("studentId", sid));
                    }
                }
            }
        }

        // Create a new tutor-owned Student record from the account details
        StudentCreateDto createDto = new StudentCreateDto();
        createDto.setFirstName(account.getFirstName() != null ? account.getFirstName() : "");
        createDto.setLastName(account.getLastName() != null ? account.getLastName() : "");

        StudentResponseDto newStudent;
        try {
            newStudent = studentService.createStudent(tutorId, createDto);
        } catch (IllegalArgumentException e) {
            log.warn("Join failed for tutor {}: {}", tutorId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }

        // Link the StudentAccount to the newly created student ID
        studentAccountService.linkToStudent(studentAccountId, newStudent.getId());

        log.info("StudentAccount {} joined tutor {} as student {}", studentAccountId, tutorId, newStudent.getId());
        return ResponseEntity.ok(Map.of("studentId", newStudent.getId()));
    }
}
