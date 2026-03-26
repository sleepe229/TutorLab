package project.TutorLab.service;

import project.TutorLab.dto.ChatParticipantInfoDto;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;

import java.util.List;

public interface ChatService {
    /** Fetch a single chat by id. */
    Chat getChat(String chatId);
    /** Resolve participant names and avatars for a chat. */
    List<ChatParticipantInfoDto> getParticipantInfo(String chatId);

    // --- DIRECT chat ---
    Chat getOrCreateChat(String tutorId, String studentAccountId, String studentName, String tutorName);
    List<Chat> getChatsForTutor(String tutorId);
    List<Chat> getChatsForStudent(String studentAccountId);

    // --- Messaging ---
    ChatMessage sendMessage(String chatId, String senderId, String senderRole, String senderName,
                            String text, String type, String inviteStudentId,
                            String fileUrl, String fileName);
    List<ChatMessage> getMessages(String chatId);
    void markReadByTutor(String chatId);
    void markReadByStudent(String chatId);

    // --- Message edit / delete ---
    /** Edit own message text within 48 hours. Returns updated message. */
    ChatMessage editMessage(String chatId, String messageId, String newText, String requesterId);
    /** Soft-delete: marks deleted=true. Returns updated message. */
    ChatMessage deleteMessage(String chatId, String messageId, String requesterId);

    // --- Group chats ---
    Chat createGroup(String groupName, List<String> participantIds,
                     String creatorId, String creatorRole, String creatorName);
    /** Add a member to an existing group. Returns updated chat. */
    Chat addGroupMember(String chatId, String participantId, String requesterId);
    /** Remove a member (or self-leave) from a group. Returns updated chat. */
    Chat removeGroupMember(String chatId, String participantId, String requesterId);
    /** Get all groups this participant belongs to. */
    List<Chat> getGroupsForParticipant(String participantId);

    // --- 1v1 moderation ---
    Chat blockChat(String chatId, String requesterId, String requesterRole);
    Chat unblockChat(String chatId, String requesterId, String requesterRole);
    Chat hideChat(String chatId, String requesterId, String requesterRole);
    Chat unhideChat(String chatId, String requesterId, String requesterRole);
}
