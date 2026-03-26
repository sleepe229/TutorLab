package project.TutorLab.repository.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.Student;
import project.TutorLab.repository.StudentRepository;
import project.TutorLab.repository.jpa.StudentJpaRepository;

import java.util.List;

@Repository
public class StudentRepositoryImpl implements StudentRepository {

    @Autowired
    private StudentJpaRepository studentJpaRepository;

    @Override
    public Student save(Student student) {
        return studentJpaRepository.save(student);
    }

    @Override
    public Student findById(String id) {
        return studentJpaRepository.findById(id).orElse(null);
    }

    @Override
    public List<Student> findByTutorId(String tutorId) {
        return studentJpaRepository.findByTutorId(tutorId);
    }

    @Override
    public void deleteById(String id) {
        studentJpaRepository.deleteById(id);
    }

    @Override
    public boolean existsById(String id) {
        return studentJpaRepository.existsById(id);
    }
}
