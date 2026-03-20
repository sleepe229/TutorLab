package project.TutorLab.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import project.TutorLab.dto.StudentCardDto;
import project.TutorLab.dto.StudentCreateDto;
import project.TutorLab.dto.StudentResponseDto;
import project.TutorLab.dto.StudentUpdateDto;
import project.TutorLab.model.ProgressNote;
import project.TutorLab.model.Student;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.StudentRepository;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.StudentService;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

@Service
public class StudentServiceImpl implements StudentService {

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private TutorRepository tutorRepository;

    @Override
    public StudentResponseDto createStudent(String tutorId, StudentCreateDto createDto) {
        if (!tutorRepository.existsById(tutorId)) {
            throw new IllegalArgumentException("Tutor with id " + tutorId + " does not exist");
        }

        String studentId = UUID.randomUUID().toString();
        
        Student student = new Student();
        student.setId(studentId);
        student.setTutorId(tutorId);
        student.setFirstName(createDto.getFirstName());
        student.setLastName(createDto.getLastName());
        student.setAge(createDto.getAge());
        student.setPhotoUrl(createDto.getPhotoUrl());
        student.setInterests(createDto.getInterests() != null ? createDto.getInterests() : new ArrayList<>());
        student.setMaterialUrls(new ArrayList<>());
        student.setLessonDates(new ArrayList<>());
        student.setLessonMaterials(new HashMap<>());
        
        studentRepository.save(student);
        
        return convertToResponseDto(student);
    }

    @Override
    public StudentResponseDto getStudentById(String id) {
        Student student = studentRepository.findById(id);
        if (student == null) {
            return null;
        }
        return convertToResponseDto(student);
    }

    @Override
    public List<StudentCardDto> getAllStudentsByTutorId(String tutorId) {
        List<Student> students = studentRepository.findByTutorId(tutorId);
        Tutor tutor = tutorRepository.findById(tutorId);
        List<String> favoriteIds = (tutor != null && tutor.getFavoriteStudentIds() != null) 
            ? tutor.getFavoriteStudentIds() 
            : new ArrayList<>();
        
        List<StudentCardDto> cardDtos = new ArrayList<>();
        
        for (Student student : students) {
            StudentCardDto cardDto = new StudentCardDto();
            cardDto.setId(student.getId());
            cardDto.setFirstName(student.getFirstName());
            cardDto.setLastName(student.getLastName());
            cardDto.setAge(student.getAge());
            cardDto.setPhotoUrl(student.getPhotoUrl());
            cardDto.setIsFavorite(favoriteIds.contains(student.getId()));
            cardDto.setLessonDates(student.getLessonDates());
            cardDtos.add(cardDto);
        }
        
        // Сортируем: избранные сначала
        cardDtos.sort((a, b) -> {
            boolean aFavorite = Boolean.TRUE.equals(a.getIsFavorite());
            boolean bFavorite = Boolean.TRUE.equals(b.getIsFavorite());
            if (aFavorite && !bFavorite) return -1;
            if (!aFavorite && bFavorite) return 1;
            return 0;
        });
        
        return cardDtos;
    }

    @Override
    public StudentResponseDto addMaterial(String studentId, String materialUrl) {
        Student student = studentRepository.findById(studentId);
        if (student == null) {
            throw new IllegalArgumentException("Student with id " + studentId + " does not exist");
        }
        
        if (student.getMaterialUrls() == null) {
            student.setMaterialUrls(new ArrayList<>());
        }
        student.getMaterialUrls().add(materialUrl);
        studentRepository.save(student);
        
        return convertToResponseDto(student);
    }

    @Override
    public StudentResponseDto addLessonDate(String studentId, String lessonDate) {
        Student student = studentRepository.findById(studentId);
        if (student == null) {
            throw new IllegalArgumentException("Student with id " + studentId + " does not exist");
        }
        
        if (student.getLessonDates() == null) {
            student.setLessonDates(new ArrayList<>());
        }
        student.getLessonDates().add(lessonDate);
        studentRepository.save(student);
        
        return convertToResponseDto(student);
    }

    @Override
    public StudentResponseDto addLessonMaterial(String studentId, String lessonDate, String materialUrl) {
        Student student = studentRepository.findById(studentId);
        if (student == null) {
            throw new IllegalArgumentException("Student with id " + studentId + " does not exist");
        }
        if (student.getLessonMaterials() == null) {
            student.setLessonMaterials(new HashMap<>());
        }
        student.getLessonMaterials()
               .computeIfAbsent(lessonDate, k -> new ArrayList<>())
               .add(materialUrl);
        studentRepository.save(student);
        return convertToResponseDto(student);
    }

    @Override
    public void deleteStudent(String studentId) {
        Student student = studentRepository.findById(studentId);
        if (student == null) {
            throw new IllegalArgumentException("Student with id " + studentId + " does not exist");
        }
        
        String tutorId = student.getTutorId();
        Tutor tutor = tutorRepository.findById(tutorId);
        if (tutor != null && tutor.getFavoriteStudentIds() != null) {
            tutor.getFavoriteStudentIds().remove(studentId);
            tutorRepository.save(tutor);
        }
        
        studentRepository.deleteById(studentId);
    }

    @Override
    public void toggleFavoriteStudent(String tutorId, String studentId) {
        Tutor tutor = tutorRepository.findById(tutorId);
        if (tutor == null) {
            throw new IllegalArgumentException("Tutor with id " + tutorId + " does not exist");
        }
        
        Student student = studentRepository.findById(studentId);
        if (student == null) {
            throw new IllegalArgumentException("Student with id " + studentId + " does not exist");
        }
        
        if (!student.getTutorId().equals(tutorId)) {
            throw new IllegalArgumentException("Student does not belong to this tutor");
        }
        
        if (tutor.getFavoriteStudentIds() == null) {
            tutor.setFavoriteStudentIds(new ArrayList<>());
        }
        
        List<String> favoriteIds = tutor.getFavoriteStudentIds();
        if (favoriteIds.contains(studentId)) {
            favoriteIds.remove(studentId);
        } else {
            favoriteIds.add(studentId);
        }
        
        tutorRepository.save(tutor);
    }

    private StudentResponseDto convertToResponseDto(Student student) {
        StudentResponseDto dto = new StudentResponseDto();
        dto.setId(student.getId());
        dto.setTutorId(student.getTutorId());
        // Resolve tutor name for display in student cabinet
        if (student.getTutorId() != null) {
            project.TutorLab.model.Tutor tutor = tutorRepository.findById(student.getTutorId());
            if (tutor != null) {
                dto.setTutorName(tutor.getFullName());
            }
        }
        dto.setFirstName(student.getFirstName());
        dto.setLastName(student.getLastName());
        dto.setAge(student.getAge());
        dto.setPhotoUrl(student.getPhotoUrl());
        dto.setInterests(student.getInterests());
        dto.setMaterialUrls(student.getMaterialUrls());
        dto.setLessonDates(student.getLessonDates());
        dto.setLessonMaterials(student.getLessonMaterials());
        dto.setPricePerLesson(student.getPricePerLesson());
        dto.setTrialLessonsCount(student.getTrialLessonsCount());
        dto.setLessonPayments(student.getLessonPayments());
        return dto;
    }

    @Override
    public StudentResponseDto updatePrice(String studentId, Integer price, int trialLessonsCount) {
        Student student = studentRepository.findById(studentId);
        if (student == null) {
            throw new IllegalArgumentException("Student with id " + studentId + " does not exist");
        }
        student.setPricePerLesson(price);
        student.setTrialLessonsCount(trialLessonsCount);
        studentRepository.save(student);
        return convertToResponseDto(student);
    }

    @Override
    public void updateLessonPayment(String studentId, String date, String status) {
        Student student = studentRepository.findById(studentId);
        if (student == null) {
            throw new IllegalArgumentException("Student with id " + studentId + " does not exist");
        }
        if (student.getLessonPayments() == null) {
            student.setLessonPayments(new HashMap<>());
        }
        student.getLessonPayments().put(date, status);
        studentRepository.save(student);
    }

    @Override
    public StudentResponseDto updateLessonDate(String studentId, String oldLessonDate, String newLessonDate) {
        Student student = studentRepository.findById(studentId);
        if (student == null) {
            throw new IllegalArgumentException("Student with id " + studentId + " does not exist");
        }
        if (student.getLessonDates() == null) {
            student.setLessonDates(new ArrayList<>());
        }
        int idx = student.getLessonDates().indexOf(oldLessonDate);
        if (idx >= 0) {
            student.getLessonDates().set(idx, newLessonDate);
        } else {
            student.getLessonDates().add(newLessonDate);
        }
        studentRepository.save(student);
        return convertToResponseDto(student);
    }

    @Override
    public StudentResponseDto updateStudentInfo(String studentId, StudentUpdateDto dto) {
        Student student = studentRepository.findById(studentId);
        if (student == null) throw new IllegalArgumentException("Student not found: " + studentId);
        if (dto.getFirstName() != null) student.setFirstName(dto.getFirstName());
        if (dto.getLastName() != null) student.setLastName(dto.getLastName());
        if (dto.getAge() != null) student.setAge(dto.getAge());
        if (dto.getInterests() != null) student.setInterests(dto.getInterests());
        studentRepository.save(student);
        return convertToResponseDto(student);
    }

    @Override
    public boolean hasAnyStudentWithTutor(List<String> studentIds, String tutorId) {
        for (String studentId : studentIds) {
            Student student = studentRepository.findById(studentId);
            if (student != null && tutorId.equals(student.getTutorId())) {
                return true;
            }
        }
        return false;
    }

    private static final int MAX_PROGRESS_NOTES = 500;

    @Override
    public ProgressNote addProgressNote(String studentId, ProgressNote note) {
        Student student = studentRepository.findById(studentId);
        if (student == null) throw new IllegalArgumentException("Student not found: " + studentId);

        note.setId(UUID.randomUUID().toString());
        if (note.getDate() == null) note.setDate(LocalDateTime.now());

        List<ProgressNote> notes = student.getProgressNotes();
        if (notes.size() >= MAX_PROGRESS_NOTES) {
            // Remove oldest note to stay within cap
            notes.remove(notes.size() - 1);
        }
        notes.add(0, note); // prepend (newest first)
        student.setProgressNotes(notes);
        studentRepository.save(student);
        return note;
    }

    @Override
    public List<ProgressNote> getProgressNotes(String studentId) {
        Student student = studentRepository.findById(studentId);
        if (student == null) throw new IllegalArgumentException("Student not found: " + studentId);
        List<ProgressNote> notes = new ArrayList<>(student.getProgressNotes());
        notes.sort(Comparator.comparing(ProgressNote::getDate, Comparator.nullsLast(Comparator.reverseOrder())));
        return notes;
    }
}

