package project.TutorLab.repository.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import project.TutorLab.model.ChatParticipant;
import project.TutorLab.model.ChatParticipantKey;

import java.util.List;

public interface ChatParticipantJpaRepository extends JpaRepository<ChatParticipant, ChatParticipantKey> {
    List<ChatParticipant> findById_ChatId(String chatId);
    List<ChatParticipant> findById_ParticipantId(String participantId);

    @Modifying
    @Transactional
    @Query("DELETE FROM ChatParticipant cp WHERE cp.id.chatId = :chatId")
    void deleteAllByChatId(@Param("chatId") String chatId);
}
