package project.TutorLab.repository.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.TutorLab.model.Chat;

import java.util.List;
import java.util.Optional;

public interface ChatJpaRepository extends JpaRepository<Chat, String> {
    List<Chat> findByTutorId(String tutorId);
    List<Chat> findByStudentAccountId(String studentAccountId);

    @Query("SELECT c FROM Chat c WHERE c.tutorId = :tutorId AND c.studentAccountId = :studentAccountId AND c.type = 'DIRECT'")
    Optional<Chat> findDirectChat(@Param("tutorId") String tutorId,
                                  @Param("studentAccountId") String studentAccountId);
}
