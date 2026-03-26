package project.TutorLab.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import project.TutorLab.dto.ChatParticipantInfoDto;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.ChatRepository;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.repository.jpa.StudentAccountJpaRepository;
import project.TutorLab.service.ChatService;
import project.TutorLab.service.MessageEncryptionService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChatServiceImpl implements ChatService {

    private static final long EDIT_WINDOW_MS = 48L * 60 * 60 * 1000; // 48 hours

    @Autowired
    private ChatRepository chatRepository;

    @Autowired
    private TutorRepository tutorRepository;

    @Autowired
    private StudentAccountJpaRepository studentAccountJpaRepository;

    @Autowired
    private MessageEncryptionService encryptionService;

    // ---- Lookup ----

    @Override
    public Chat getChat(String chatId) {
        return chatRepository.findById(chatId);
    }

    @Override
    public List<ChatParticipantInfoDto> getParticipantInfo(String chatId) {
        Chat chat = chatRepository.findById(chatId);
        if (chat == null) return List.of();

        List<String> ids = chat.isGroup()
            ? chat.getParticipantIds()
            : List.of(chat.getTutorId(), chat.getStudentAccountId());

        List<String> adminIds = chat.getAdminIds() != null ? chat.getAdminIds() : List.of();

        return ids.stream().map(pid -> {
            Tutor t = tutorRepository.findById(pid);
            if (t != null) {
                return new ChatParticipantInfoDto(pid,
                    t.getFullName() != null ? t.getFullName() : pid,
                    t.getPhotoUrl(),
                    adminIds.contains(pid));
            }
            return studentAccountJpaRepository.findById(pid)
                .map(sa -> {
                    String firstName = sa.getFirstName() != null ? sa.getFirstName() : "";
                    String lastName  = sa.getLastName()  != null ? sa.getLastName()  : "";
                    String name = (firstName + " " + lastName).trim();
                    if (name.isEmpty()) name = pid;
                    return new ChatParticipantInfoDto(pid, name, sa.getPhotoUrl(), adminIds.contains(pid));
                })
                .orElse(new ChatParticipantInfoDto(pid, pid, null, adminIds.contains(pid)));
        }).collect(Collectors.toList());
    }

    // ---- DIRECT chat ----

    @Override
    public Chat getOrCreateChat(String tutorId, String studentAccountId, String studentName, String tutorName) {
        Chat existing = chatRepository.findByTutorAndStudent(tutorId, studentAccountId);
        if (existing != null) return existing;
        Chat chat = new Chat(UUID.randomUUID().toString(), tutorId, tutorName, studentAccountId, studentName);
        return chatRepository.save(chat);
    }

    @Override
    public List<Chat> getChatsForTutor(String tutorId) {
        List<Chat> chats = chatRepository.findByTutorId(tutorId);
        // filter out chats hidden for tutor
        chats.removeIf(c -> "DIRECT".equals(c.getType()) && c.isHiddenForTutor());
        return chats;
    }

    @Override
    public List<Chat> getChatsForStudent(String studentAccountId) {
        List<Chat> chats = chatRepository.findByStudentAccountId(studentAccountId);
        // filter out chats hidden for student
        chats.removeIf(c -> "DIRECT".equals(c.getType()) && c.isHiddenForStudent());
        return chats;
    }

    // ---- Messaging ----

    @Override
    public ChatMessage sendMessage(String chatId, String senderId, String senderRole, String senderName,
                                   String text, String type, String inviteStudentId,
                                   String fileUrl, String fileName) {
        Chat chat = chatRepository.findById(chatId);
        if (chat != null && "DIRECT".equals(chat.getType()) && chat.isBlocked()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chat is blocked");
        }
        if (chat != null && "GROUP".equals(chat.getType())
                && !chat.getParticipantIds().contains(senderId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a group member");
        }

        ChatMessage message = new ChatMessage();
        message.setId(UUID.randomUUID().toString());
        message.setChatId(chatId);
        message.setSenderId(senderId);
        message.setSenderRole(senderRole);
        message.setSenderName(senderName);
        message.setText(encryptionService.encrypt(text));
        message.setType(type != null ? type : "TEXT");
        message.setInviteStudentId(inviteStudentId);
        message.setFileUrl(fileUrl);
        message.setFileName(encryptionService.encrypt(fileName));
        message.setTimestamp(System.currentTimeMillis());

        chatRepository.saveMessage(chatId, message);

        if (chat != null) {
            chat.setLastMessage(text); // store plaintext in lastMessage preview
            chat.setLastTimestamp(message.getTimestamp());
            if ("TUTOR".equals(senderRole)) {
                chat.setUnreadCountStudent(chat.getUnreadCountStudent() + 1);
            } else if ("STUDENT".equals(senderRole)) {
                chat.setUnreadCountTutor(chat.getUnreadCountTutor() + 1);
            } else {
                // GROUP: increment for all (simplified; could track per-member)
                chat.setUnreadCountTutor(chat.getUnreadCountTutor() + 1);
            }
            chatRepository.save(chat);
        }

        // Return message with decrypted text for the response
        message.setText(text);
        message.setFileName(fileName);
        return message;
    }

    @Override
    public List<ChatMessage> getMessages(String chatId) {
        List<ChatMessage> messages = chatRepository.getMessages(chatId);
        messages.forEach(m -> {
            m.setText(encryptionService.decrypt(m.getText()));
            m.setFileName(encryptionService.decrypt(m.getFileName()));
        });
        return messages;
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

    // ---- Message edit / delete ----

    @Override
    public ChatMessage editMessage(String chatId, String messageId, String newText, String requesterId) {
        List<ChatMessage> messages = chatRepository.getMessages(chatId);
        ChatMessage target = messages.stream()
                .filter(m -> messageId.equals(m.getId()))
                .findFirst()
                .orElse(null);
        if (target == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found");
        }
        // Decrypt stored text before ownership/window checks
        target.setText(encryptionService.decrypt(target.getText()));
        if (!requesterId.equals(target.getSenderId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your message");
        }
        if (target.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Message is deleted");
        }
        long age = System.currentTimeMillis() - target.getTimestamp();
        if (age > EDIT_WINDOW_MS) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Edit window expired (48h)");
        }
        target.setText(encryptionService.encrypt(newText));
        target.setEditedAt(System.currentTimeMillis());
        chatRepository.updateMessage(chatId, target);
        target.setText(newText); // return plaintext
        return target;
    }

    @Override
    public ChatMessage deleteMessage(String chatId, String messageId, String requesterId) {
        List<ChatMessage> messages = chatRepository.getMessages(chatId);
        ChatMessage target = messages.stream()
                .filter(m -> messageId.equals(m.getId()))
                .findFirst()
                .orElse(null);
        if (target == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found");
        }
        if (!requesterId.equals(target.getSenderId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your message");
        }
        target.setDeleted(true);
        target.setText("");
        chatRepository.updateMessage(chatId, target);
        return target;
    }

    // ---- Group chats ----

    @Override
    public Chat createGroup(String groupName, List<String> participantIds,
                            String creatorId, String creatorRole, String creatorName) {
        Chat chat = new Chat();
        chat.setId(UUID.randomUUID().toString());
        chat.setType("GROUP");
        chat.setGroupName(groupName);
        chat.setCreatorId(creatorId);
        chat.setCreatorRole(creatorRole);
        chat.setLastTimestamp(System.currentTimeMillis());

        List<String> members = new ArrayList<>(participantIds);
        if (!members.contains(creatorId)) members.add(0, creatorId);
        chat.setParticipantIds(members);

        List<String> admins = new ArrayList<>();
        admins.add(creatorId);
        chat.setAdminIds(admins);

        chatRepository.save(chat);
        for (String pid : members) {
            chatRepository.addToGroupIndex(pid, chat.getId());
        }

        // System message
        ChatMessage sysMsg = new ChatMessage();
        sysMsg.setId(UUID.randomUUID().toString());
        sysMsg.setChatId(chat.getId());
        sysMsg.setSenderId(creatorId);
        sysMsg.setSenderRole(creatorRole);
        sysMsg.setSenderName(creatorName);
        sysMsg.setType("SYSTEM");
        sysMsg.setText(encryptionService.encrypt("Группа создана"));
        sysMsg.setTimestamp(System.currentTimeMillis());
        chatRepository.saveMessage(chat.getId(), sysMsg);

        return chat;
    }

    @Override
    public Chat addGroupMember(String chatId, String participantId, String requesterId) {
        Chat chat = chatRepository.findById(chatId);
        if (chat == null || !chat.isGroup()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found");
        }
        if (!chat.getAdminIds().contains(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can add members");
        }
        if (!chat.getParticipantIds().contains(participantId)) {
            chat.getParticipantIds().add(participantId);
            chatRepository.save(chat);
            chatRepository.addToGroupIndex(participantId, chatId);
        }
        return chat;
    }

    @Override
    public Chat removeGroupMember(String chatId, String participantId, String requesterId) {
        Chat chat = chatRepository.findById(chatId);
        if (chat == null || !chat.isGroup()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found");
        }
        boolean isSelf = requesterId.equals(participantId);
        boolean isAdmin = chat.getAdminIds().contains(requesterId);
        if (!isSelf && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        chat.getParticipantIds().remove(participantId);
        chat.getAdminIds().remove(participantId);
        chat.getHiddenForMembers().remove(participantId);
        // If no admins left but members remain, promote next member
        if (chat.getAdminIds().isEmpty() && !chat.getParticipantIds().isEmpty()) {
            chat.getAdminIds().add(chat.getParticipantIds().get(0));
        }
        chatRepository.save(chat);
        chatRepository.removeFromGroupIndex(participantId, chatId);
        return chat;
    }

    @Override
    public List<Chat> getGroupsForParticipant(String participantId) {
        List<Chat> groups = chatRepository.findGroupsByParticipantId(participantId);
        // filter out groups this participant has hidden
        groups.removeIf(c -> c.getHiddenForMembers().contains(participantId));
        return groups;
    }

    // ---- 1v1 moderation ----

    @Override
    public Chat blockChat(String chatId, String requesterId, String requesterRole) {
        Chat chat = chatRepository.findById(chatId);
        if (chat == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found");
        if ("TUTOR".equals(requesterRole)) chat.setBlockedByTutor(true);
        else chat.setBlockedByStudent(true);
        chatRepository.save(chat);
        return chat;
    }

    @Override
    public Chat unblockChat(String chatId, String requesterId, String requesterRole) {
        Chat chat = chatRepository.findById(chatId);
        if (chat == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found");
        if ("TUTOR".equals(requesterRole)) chat.setBlockedByTutor(false);
        else chat.setBlockedByStudent(false);
        chatRepository.save(chat);
        return chat;
    }

    @Override
    public Chat hideChat(String chatId, String requesterId, String requesterRole) {
        Chat chat = chatRepository.findById(chatId);
        if (chat == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found");
        if (chat.isGroup()) {
            if (!chat.getHiddenForMembers().contains(requesterId)) {
                chat.getHiddenForMembers().add(requesterId);
            }
        } else {
            if ("TUTOR".equals(requesterRole)) chat.setHiddenForTutor(true);
            else chat.setHiddenForStudent(true);
        }
        chatRepository.save(chat);
        return chat;
    }

    @Override
    public Chat unhideChat(String chatId, String requesterId, String requesterRole) {
        Chat chat = chatRepository.findById(chatId);
        if (chat == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found");
        if (chat.isGroup()) {
            chat.getHiddenForMembers().remove(requesterId);
        } else {
            if ("TUTOR".equals(requesterRole)) chat.setHiddenForTutor(false);
            else chat.setHiddenForStudent(false);
        }
        chatRepository.save(chat);
        return chat;
    }
}
