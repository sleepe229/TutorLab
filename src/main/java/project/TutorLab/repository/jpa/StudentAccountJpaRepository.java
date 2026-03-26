package project.TutorLab.repository.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import project.TutorLab.model.StudentAccount;

import java.util.Optional;

public interface StudentAccountJpaRepository extends JpaRepository<StudentAccount, String> {
    Optional<StudentAccount> findByEmailIgnoreCase(String email);
    Optional<StudentAccount> findByGoogleId(String googleId);
    boolean existsByEmailIgnoreCase(String email);
}
