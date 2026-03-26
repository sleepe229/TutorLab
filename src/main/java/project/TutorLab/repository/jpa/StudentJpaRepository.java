package project.TutorLab.repository.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import project.TutorLab.model.Student;

import java.util.List;

public interface StudentJpaRepository extends JpaRepository<Student, String> {
    List<Student> findByTutorId(String tutorId);
}
