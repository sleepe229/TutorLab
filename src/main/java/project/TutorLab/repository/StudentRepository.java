package project.TutorLab.repository;

import project.TutorLab.model.Student;
import java.util.List;

public interface StudentRepository {
    Student save(Student student);
    Student findById(String id);
    List<Student> findByTutorId(String tutorId);
    void deleteById(String id);
    boolean existsById(String id);
}

