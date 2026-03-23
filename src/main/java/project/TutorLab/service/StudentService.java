package project.TutorLab.service;

import project.TutorLab.dto.StudentCardDto;
import project.TutorLab.dto.StudentCreateDto;
import project.TutorLab.dto.StudentResponseDto;
import project.TutorLab.dto.StudentUpdateDto;
import project.TutorLab.model.ProgressNote;

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
    boolean hasAnyStudentWithTutor(List<String> studentIds, String tutorId);

    StudentResponseDto updateStudentInfo(String studentId, StudentUpdateDto dto);

    /** Adds a progress note to the student. Capped at 500 notes per student. */
    ProgressNote addProgressNote(String studentId, ProgressNote note);

    /** Returns all progress notes for a student, newest first. */
    List<ProgressNote> getProgressNotes(String studentId);

    /** Links a StudentAccount to this student profile for navigation and messaging. */
    void setStudentAccountId(String studentId, String studentAccountId);
}

