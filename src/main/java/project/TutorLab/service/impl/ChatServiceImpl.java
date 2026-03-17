package project.TutorLab.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;
import project.TutorLab.repository.ChatRepository;
import project.TutorLab.service.ChatService;

import java.util.List;
import java.util.UUID;

@Service
public class ChatServiceImpl implements ChatService {

    @Autowired
    private ChatRepository chatRepository;

    @Override
    public Chat getOrCreateChat(String tutorId, String studentAccountId, String studentName, String tutorName) {
        Chat existing = chatRepository.findByTutorAndStudent(tutorId, studentAccountId);
        if (existing != null) return existing;
        Chat chat = new Chat(UUID.randomUUID().toString(), tutorId, tutorName, studentAccountId, studentName);
        return chatRepository.save(chat);
    }

    @Override
    public List<Chat> getChatsForTutor(String tutorId) {
        return chatRepository.findByTutorId(tutorId);
    }

    @Override
    public List<Chat> getChatsForStudent(String studentAccountId) {
        return chatRepository.findByStudentAccountId(studentAccountId);
    }

    @Override
    public ChatMessage sendMessage(String chatId, String senderId, String senderRole, String senderName,
                                   String text, String type, String inviteStudentId) {
        ChatMessage message = new ChatMessage();
        message.setId(UUID.randomUUID().toString());
        message.setChatId(chatId);
        message.setSenderId(senderId);
        message.setSenderRole(senderRole);
        message.setSenderName(senderName);
        message.setText(text);
        message.setType(type != null ? type : "TEXT");
        message.setInviteStudentId(inviteStudentId);
        message.setTimestamp(System.currentTimeMillis());

        chatRepository.saveMessage(chatId, message);

        Chat chat = chatRepository.findById(chatId);
        if (chat != null) {
            chat.setLastMessage(text);
            chat.setLastTimestamp(message.getTimestamp());
            if ("TUTOR".equals(senderRole)) {
                chat.setUnreadCountStudent(chat.getUnreadCountStudent() + 1);
            } else {
                chat.setUnreadCountTutor(chat.getUnreadCountTutor() + 1);
            }
            chatRepository.save(chat);
        }

        return message;
    }

    @Override
    public List<ChatMessage> getMessages(String chatId) {
        return chatRepository.getMessages(chatId);
    }

    @Override
    public void markReadByTutor(String chatId) {
        Chat chat = chatRepository.findById(chatId);
        if (chat != null) {
            chat.setUnreadCountTutor(0);
            chatRepository.save(chat);
        }
    }

    @Override
    public void markReadByStudent(String chatId) {
        Chat chat = chatRepository.findById(chatId);
        if (chat != null) {
            chat.setUnreadCountStudent(0);
            chatRepository.save(chat);
        }
    }
}
