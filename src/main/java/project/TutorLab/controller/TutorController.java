package project.TutorLab.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TutorLab.dto.TutorLoginDto;
import project.TutorLab.dto.TutorRegistrationDto;
import project.TutorLab.dto.TutorResponseDto;
import project.TutorLab.dto.TutorUpdateDto;
import project.TutorLab.service.TutorService;

import java.util.List;

@RestController
@RequestMapping("/api/tutors")
@CrossOrigin(origins = "*")
public class TutorController {

    private final TutorService tutorService;

    public TutorController(TutorService tutorService) {
        this.tutorService = tutorService;
    }

    @PostMapping("/register")
    public ResponseEntity<TutorResponseDto> registerTutor(@RequestBody TutorRegistrationDto registrationDto) {
        try {
            TutorResponseDto response = tutorService.registerTutor(registrationDto);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).build();
        }
    }

    @PostMapping("/login")
    public ResponseEntity<TutorResponseDto> loginTutor(@RequestBody TutorLoginDto loginDto) {
        try {
            TutorResponseDto response = tutorService.loginTutor(loginDto);
            return ResponseEntity.ok(response);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).build();
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
    public ResponseEntity<TutorResponseDto> updateTutor(@PathVariable String id, @RequestBody TutorUpdateDto updateDto) {
        try {
            TutorResponseDto response = tutorService.updateTutor(id, updateDto);
            return ResponseEntity.ok(response);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).build();
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
}

