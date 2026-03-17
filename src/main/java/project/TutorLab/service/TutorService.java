package project.TutorLab.service;

import project.TutorLab.dto.TutorLoginDto;
import project.TutorLab.dto.TutorRegistrationDto;
import project.TutorLab.dto.TutorResponseDto;
import project.TutorLab.dto.TutorUpdateDto;

import java.util.List;

public interface TutorService {
    TutorResponseDto registerTutor(TutorRegistrationDto registrationDto);
    TutorResponseDto loginTutor(TutorLoginDto loginDto);
    TutorResponseDto getTutorById(String id);
    TutorResponseDto updateTutor(String id, TutorUpdateDto updateDto);
    boolean tutorExists(String id);
    boolean loginExists(String login);
    List<TutorResponseDto> getPublicTutors();
}

