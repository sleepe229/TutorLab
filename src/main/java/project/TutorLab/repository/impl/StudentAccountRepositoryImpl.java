package project.TutorLab.repository.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.repository.StudentAccountRepository;
import project.TutorLab.repository.jpa.StudentAccountJpaRepository;

@Repository
public class StudentAccountRepositoryImpl implements StudentAccountRepository {

    @Autowired
    private StudentAccountJpaRepository studentAccountJpaRepository;

    @Override
    public StudentAccount save(StudentAccount account) {
        return studentAccountJpaRepository.save(account);
    }

    @Override
    public StudentAccount findById(String id) {
        return studentAccountJpaRepository.findById(id).orElse(null);
    }

    @Override
    public StudentAccount findByEmail(String email) {
        return studentAccountJpaRepository.findByEmailIgnoreCase(email).orElse(null);
    }

    @Override
    public StudentAccount findByGoogleId(String googleId) {
        return studentAccountJpaRepository.findByGoogleId(googleId).orElse(null);
    }

    @Override
    public boolean existsByEmail(String email) {
        return studentAccountJpaRepository.existsByEmailIgnoreCase(email);
    }
}
