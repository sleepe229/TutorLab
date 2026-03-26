package project.TutorLab.repository.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import project.TutorLab.model.ChatMessage;

import java.util.List;

public interface ChatMessageJpaRepository extends JpaRepository<ChatMessage, String> {
    List<ChatMessage> findByChatIdOrderByTimestampAsc(String chatId);
}
