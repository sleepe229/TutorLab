package project.TutorLab.service;

import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;

import java.util.List;

public interface ChatService {
    Chat getOrCreateChat(String tutorId, String studentAccountId, String studentName, String tutorName);
    List<Chat> getChatsForTutor(String tutorId);
    List<Chat> getChatsForStudent(String studentAccountId);
    ChatMessage sendMessage(String chatId, String senderId, String senderRole, String senderName,
                            String text, String type, String inviteStudentId,
                            String fileUrl, String fileName);
    List<ChatMessage> getMessages(String chatId);
    void markReadByTutor(String chatId);
    void markReadByStudent(String chatId);
}
