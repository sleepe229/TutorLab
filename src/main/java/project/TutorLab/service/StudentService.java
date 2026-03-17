package project.TutorLab.service;

import project.TutorLab.dto.StudentCardDto;
import project.TutorLab.dto.StudentCreateDto;
import project.TutorLab.dto.StudentResponseDto;

import java.util.List;

public interface StudentService {
    StudentResponseDto createStudent(String tutorId, StudentCreateDto createDto);
    StudentResponseDto getStudentById(String id);
    List<StudentCardDto> getAllStudentsByTutorId(String tutorId);
    StudentResponseDto addMaterial(String studentId, String materialUrl);
    StudentResponseDto addLessonDate(String studentId, String lessonDate);
    StudentResponseDto addLessonMaterial(String studentId, String lessonDate, String materialUrl);
    void deleteStudent(String studentId);
    void toggleFavoriteStudent(String tutorId, String studentId);
    StudentResponseDto updatePrice(String studentId, Integer price, int trialLessonsCount);
    void updateLessonPayment(String studentId, String date, String status);
    StudentResponseDto updateLessonDate(String studentId, String oldLessonDate, String newLessonDate);
}

