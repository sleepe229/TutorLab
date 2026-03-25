package project.TutorLab.repository;

import project.TutorLab.model.StudentAccount;

public interface StudentAccountRepository {
    StudentAccount save(StudentAccount account);
    StudentAccount findById(String id);
    StudentAccount findByEmail(String email);
    StudentAccount findByGoogleId(String googleId);
    boolean existsByEmail(String email);
}
