package project.TutorLab.repository.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import project.TutorLab.model.Tutor;

import java.util.List;
import java.util.Optional;

public interface TutorJpaRepository extends JpaRepository<Tutor, String> {
    Optional<Tutor> findByLogin(String login);
    Optional<Tutor> findByGoogleId(String googleId);
    Optional<Tutor> findByEmail(String email);
    boolean existsByLogin(String login);

    @Query("SELECT t FROM Tutor t WHERE t.isPublicProfile = TRUE")
    List<Tutor> findAllPublicTutors();
}
