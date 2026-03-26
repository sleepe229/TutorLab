package project.TutorLab.repository.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import project.TutorLab.model.SessionSnapshot;

import java.util.List;
import java.util.Optional;

public interface SessionSnapshotJpaRepository extends JpaRepository<SessionSnapshot, String> {
    Optional<SessionSnapshot> findBySessionId(String sessionId);
    List<SessionSnapshot> findByTutorId(String tutorId);
    List<SessionSnapshot> findByStudentId(String studentId);
}
