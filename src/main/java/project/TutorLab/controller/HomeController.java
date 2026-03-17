package project.TutorLab.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.dto.StudentCardDto;
import project.TutorLab.service.StudentService;

import java.util.List;

@RestController
@RequestMapping("/api/home")
@CrossOrigin(origins = "*")
public class HomeController {

    private final StudentService studentService;

    public HomeController(StudentService studentService) {
        this.studentService = studentService;
    }

    @GetMapping("/tutor/{tutorId}/students")
    public ResponseEntity<List<StudentCardDto>> getStudentCards(@PathVariable String tutorId) {
        List<StudentCardDto> students = studentService.getAllStudentsByTutorId(tutorId);
        return ResponseEntity.ok(students);
    }
}

