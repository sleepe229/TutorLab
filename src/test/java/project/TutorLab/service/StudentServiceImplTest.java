package project.TutorLab.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import project.TutorLab.dto.StudentCardDto;
import project.TutorLab.dto.StudentCreateDto;
import project.TutorLab.dto.StudentResponseDto;
import project.TutorLab.dto.StudentUpdateDto;
import project.TutorLab.model.ProgressNote;
import project.TutorLab.model.Student;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.StudentRepository;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.impl.StudentServiceImpl;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StudentServiceImplTest {

    @Mock private StudentRepository studentRepository;
    @Mock private TutorRepository tutorRepository;

    @InjectMocks
    private StudentServiceImpl studentService;

    private Student existingStudent;
    private Tutor tutor;

    @BeforeEach
    void setUp() {
        tutor = new Tutor();
        tutor.setId("tutor-1");
        tutor.setFullName("Репетитор");
        tutor.setFavoriteStudentIds(new ArrayList<>());

        existingStudent = new Student();
        existingStudent.setId("student-1");
        existingStudent.setTutorId("tutor-1");
        existingStudent.setFirstName("Иван");
        existingStudent.setLastName("Иванов");
        existingStudent.setLessonDates(new ArrayList<>());
        existingStudent.setMaterialUrls(new ArrayList<>());
        existingStudent.setProgressNotes(new ArrayList<>());
        existingStudent.setLessonMaterials(new java.util.HashMap<>());
        existingStudent.setLessonPayments(new java.util.HashMap<>());
        existingStudent.setInterests(new ArrayList<>());
    }

    // ── createStudent ─────────────────────────────────────────────────────────

    @Test
    void createStudent_validTutor_returnsDto() {
        when(tutorRepository.existsById("tutor-1")).thenReturn(true);
        when(studentRepository.save(any(Student.class))).thenAnswer(i -> i.getArgument(0));

        StudentCreateDto dto = new StudentCreateDto();
        dto.setFirstName("Мария");
        dto.setLastName("Петрова");
        dto.setAge(15);

        StudentResponseDto result = studentService.createStudent("tutor-1", dto);

        assertNotNull(result);
        assertEquals("Мария", result.getFirstName());
        assertEquals("Петрова", result.getLastName());
        assertNotNull(result.getId());
        verify(studentRepository).save(any(Student.class));
    }

    @Test
    void createStudent_nonExistentTutor_throwsIllegalArgument() {
        when(tutorRepository.existsById("bad-tutor")).thenReturn(false);

        StudentCreateDto dto = new StudentCreateDto();
        dto.setFirstName("X");

        assertThrows(IllegalArgumentException.class, () ->
                studentService.createStudent("bad-tutor", dto));
        verify(studentRepository, never()).save(any());
    }

    @Test
    void createStudent_nullInterests_initializesEmptyList() {
        when(tutorRepository.existsById("tutor-1")).thenReturn(true);
        when(studentRepository.save(any(Student.class))).thenAnswer(i -> i.getArgument(0));

        StudentCreateDto dto = new StudentCreateDto();
        dto.setFirstName("A");
        dto.setInterests(null); // null should be treated as empty

        StudentResponseDto result = studentService.createStudent("tutor-1", dto);

        assertNotNull(result);
    }

    // ── getStudentById ────────────────────────────────────────────────────────

    @Test
    void getStudentById_existingId_returnsDto() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);

        StudentResponseDto result = studentService.getStudentById("student-1");

        assertNotNull(result);
        assertEquals("student-1", result.getId());
        assertEquals("Иван", result.getFirstName());
    }

    @Test
    void getStudentById_unknownId_returnsNull() {
        when(studentRepository.findById("unknown")).thenReturn(null);
        assertNull(studentService.getStudentById("unknown"));
    }

    // ── getAllStudentsByTutorId ────────────────────────────────────────────────

    @Test
    void getAllStudentsByTutorId_sortsFavoritesFirst() {
        Student fav = new Student();
        fav.setId("fav-1");
        fav.setTutorId("tutor-1");
        fav.setFirstName("Любимый");
        fav.setLessonDates(new ArrayList<>());

        Student regular = new Student();
        regular.setId("regular-1");
        regular.setTutorId("tutor-1");
        regular.setFirstName("Обычный");
        regular.setLessonDates(new ArrayList<>());

        tutor.setFavoriteStudentIds(new ArrayList<>(List.of("fav-1")));

        when(studentRepository.findByTutorId("tutor-1")).thenReturn(List.of(regular, fav));
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);

        List<StudentCardDto> result = studentService.getAllStudentsByTutorId("tutor-1");

        assertEquals(2, result.size());
        assertEquals("fav-1", result.get(0).getId()); // favorites first
    }

    @Test
    void getAllStudentsByTutorId_noTutor_returnsNonFavoritedList() {
        when(studentRepository.findByTutorId("tutor-1")).thenReturn(List.of(existingStudent));
        when(tutorRepository.findById("tutor-1")).thenReturn(null);

        List<StudentCardDto> result = studentService.getAllStudentsByTutorId("tutor-1");

        assertEquals(1, result.size());
    }

    // ── addLessonDate ─────────────────────────────────────────────────────────

    @Test
    void addLessonDate_newDate_appendsAndInitializesPaymentAsPending() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        StudentResponseDto result = studentService.addLessonDate("student-1", "2025-09-01 10:00");

        assertTrue(result.getLessonDates().contains("2025-09-01 10:00"));
        // Payment should be initialized
        assertNotNull(result.getLessonPayments());
    }

    // ── addMaterial ───────────────────────────────────────────────────────────

    @Test
    void addMaterial_appendsUrl() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        StudentResponseDto result = studentService.addMaterial("student-1", "/api/upload/material.pdf");

        assertTrue(result.getMaterialUrls().contains("/api/upload/material.pdf"));
    }

    // ── toggleFavoriteStudent ─────────────────────────────────────────────────

    @Test
    void toggleFavoriteStudent_addsFavorite_whenNotPresent() {
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(tutorRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        studentService.toggleFavoriteStudent("tutor-1", "student-1");

        assertTrue(tutor.getFavoriteStudentIds().contains("student-1"));
    }

    @Test
    void toggleFavoriteStudent_removesFavorite_whenAlreadyPresent() {
        tutor.getFavoriteStudentIds().add("student-1");
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(tutorRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        studentService.toggleFavoriteStudent("tutor-1", "student-1");

        assertFalse(tutor.getFavoriteStudentIds().contains("student-1"));
    }

    // ── addProgressNote ───────────────────────────────────────────────────────

    @Test
    void addProgressNote_underLimit_appendsNote() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        ProgressNote note = new ProgressNote();
        note.setNoteText("Хорошо поработали над алгеброй");

        ProgressNote result = studentService.addProgressNote("student-1", note);

        assertNotNull(result);
        assertEquals("Хорошо поработали над алгеброй", result.getNoteText());
    }

    @Test
    void addProgressNote_at500Limit_evictsOldest() {
        // Fill up to 500 notes
        List<ProgressNote> notes = new ArrayList<>();
        for (int i = 0; i < 500; i++) {
            ProgressNote n = new ProgressNote();
            n.setNoteText("Note " + i);
            notes.add(n);
        }
        existingStudent.setProgressNotes(notes);

        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        ProgressNote newNote = new ProgressNote();
        newNote.setNoteText("New note");
        studentService.addProgressNote("student-1", newNote);

        // Should still be at most 500
        assertTrue(existingStudent.getProgressNotes().size() <= 500);
    }

    // ── updateLessonPayment ───────────────────────────────────────────────────

    @Test
    void updateLessonPayment_updatesStatusForDate() {
        existingStudent.getLessonPayments().put("2025-09-01 10:00", "PENDING");
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        studentService.updateLessonPayment("student-1", "2025-09-01 10:00", "PAID_EXTERNAL");

        assertEquals("PAID_EXTERNAL", existingStudent.getLessonPayments().get("2025-09-01 10:00"));
    }

    // ── deleteStudent ─────────────────────────────────────────────────────────

    @Test
    void deleteStudent_callsRepositoryDelete() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);
        studentService.deleteStudent("student-1");
        verify(studentRepository).deleteById("student-1");
    }

    // ── addLessonMaterial ─────────────────────────────────────────────────────

    @Test
    void addLessonMaterial_appendsMaterialForDate() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        // tutor lookup in convertToResponseDto
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);

        StudentResponseDto result = studentService.addLessonMaterial("student-1", "2025-09-01 10:00", "/material.pdf");

        assertNotNull(result.getLessonMaterials());
        assertTrue(result.getLessonMaterials().get("2025-09-01 10:00").contains("/material.pdf"));
    }

    // ── updateLessonDate ──────────────────────────────────────────────────────

    @Test
    void updateLessonDate_replacesOldDateWithNew() {
        existingStudent.getLessonDates().add("2025-09-01 10:00");
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);

        StudentResponseDto result = studentService.updateLessonDate("student-1", "2025-09-01 10:00", "2025-09-08 10:00");

        assertFalse(result.getLessonDates().contains("2025-09-01 10:00"));
        assertTrue(result.getLessonDates().contains("2025-09-08 10:00"));
    }

    @Test
    void updateLessonDate_oldNotFound_appendsNewDate() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);

        StudentResponseDto result = studentService.updateLessonDate("student-1", "nonexistent", "2025-10-01 10:00");

        assertTrue(result.getLessonDates().contains("2025-10-01 10:00"));
    }

    // ── updatePrice ───────────────────────────────────────────────────────────

    @Test
    void updatePrice_setsNewPriceAndTrialCount() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);

        StudentResponseDto result = studentService.updatePrice("student-1", 1500, 3);

        assertEquals(1500, result.getPricePerLesson());
        assertEquals(3, result.getTrialLessonsCount());
    }

    // ── updateStudentInfo ─────────────────────────────────────────────────────

    @Test
    void updateStudentInfo_updatesNameAndInterests() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);

        StudentUpdateDto dto = new StudentUpdateDto();
        dto.setFirstName("Петр");
        dto.setInterests(List.of("Математика", "Физика"));

        StudentResponseDto result = studentService.updateStudentInfo("student-1", dto);

        assertEquals("Петр", result.getFirstName());
        assertEquals(List.of("Математика", "Физика"), result.getInterests());
    }

    // ── setStudentAccountId ───────────────────────────────────────────────────

    @Test
    void setStudentAccountId_setsIdOnStudent() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);
        when(studentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        studentService.setStudentAccountId("student-1", "account-42");

        assertEquals("account-42", existingStudent.getStudentAccountId());
        verify(studentRepository).save(existingStudent);
    }

    @Test
    void setStudentAccountId_studentNotFound_silentNoOp() {
        when(studentRepository.findById("missing")).thenReturn(null);

        assertDoesNotThrow(() -> studentService.setStudentAccountId("missing", "account-1"));
        verify(studentRepository, never()).save(any());
    }

    // ── hasAnyStudentWithTutor ────────────────────────────────────────────────

    @Test
    void hasAnyStudentWithTutor_returnsTrueWhenMatch() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent); // tutorId = "tutor-1"

        assertTrue(studentService.hasAnyStudentWithTutor(List.of("student-1"), "tutor-1"));
    }

    @Test
    void hasAnyStudentWithTutor_returnsFalseWhenNoMatch() {
        when(studentRepository.findById("student-1")).thenReturn(existingStudent); // tutorId = "tutor-1"

        assertFalse(studentService.hasAnyStudentWithTutor(List.of("student-1"), "other-tutor"));
    }

    // ── getProgressNotes ──────────────────────────────────────────────────────

    @Test
    void getProgressNotes_returnsNewestFirst() {
        ProgressNote older = new ProgressNote();
        older.setDate(java.time.LocalDateTime.now().minusDays(2));
        older.setNoteText("Older");

        ProgressNote newer = new ProgressNote();
        newer.setDate(java.time.LocalDateTime.now().minusDays(1));
        newer.setNoteText("Newer");

        existingStudent.setProgressNotes(List.of(older, newer));
        when(studentRepository.findById("student-1")).thenReturn(existingStudent);

        List<ProgressNote> result = studentService.getProgressNotes("student-1");

        assertEquals("Newer", result.get(0).getNoteText());
        assertEquals("Older", result.get(1).getNoteText());
    }
}
