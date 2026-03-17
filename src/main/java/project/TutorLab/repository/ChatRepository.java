package project.TutorLab.repository;

import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;

import java.util.List;

public interface ChatRepository {
    Chat save(Chat chat);
    Chat findById(String id);
    List<Chat> findByTutorId(String tutorId);
    List<Chat> findByStudentAccountId(String studentAccountId);
    Chat findByTutorAndStudent(String tutorId, String studentAccountId);
    void saveMessage(String chatId, ChatMessage message);
    List<ChatMessage> getMessages(String chatId);
}
