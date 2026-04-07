package project.TutorLab.repository.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;
import project.TutorLab.model.ChatParticipant;
import project.TutorLab.repository.ChatRepository;
import project.TutorLab.repository.jpa.ChatJpaRepository;
import project.TutorLab.repository.jpa.ChatMessageJpaRepository;
import project.TutorLab.repository.jpa.ChatParticipantJpaRepository;
import project.TutorLab.repository.jpa.StudentAccountJpaRepository;
import project.TutorLab.repository.jpa.TutorJpaRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
public class ChatRepositoryImpl implements ChatRepository {

    @Autowired
    private ChatJpaRepository chatJpaRepository;

    @Autowired
    private ChatMessageJpaRepository chatMessageJpaRepository;

    @Autowired
    private ChatParticipantJpaRepository chatParticipantJpaRepository;

    @Autowired
    private StudentAccountJpaRepository studentAccountJpaRepository;

    @Autowired
    private TutorJpaRepository tutorJpaRepository;

    @Override
    @Transactional
    public Chat save(Chat chat) {
        chatJpaRepository.save(chat);

        if (chat.isGroup()) {
            // Sync chat_participants table with current transient fields
            chatParticipantJpaRepository.deleteAllByChatId(chat.getId());

            List<String> participants = chat.getParticipantIds();
            List<String> admins = chat.getAdminIds();
            List<String> hidden = chat.getHiddenForMembers();

            for (String pid : participants) {
                boolean isAdmin = admins != null && admins.contains(pid);
                boolean isHidden = hidden != null && hidden.contains(pid);
                chatParticipantJpaRepository.save(new ChatParticipant(chat.getId(), pid, isAdmin, isHidden));
            }
        }

        return chat;
    }

    @Override
    @Transactional(readOnly = true)
    public Chat findById(String id) {
        Chat chat = chatJpaRepository.findById(id).orElse(null);
        if (chat != null) populateTransientFields(chat);
        return chat;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Chat> findByTutorId(String tutorId) {
        List<Chat> chats = chatJpaRepository.findByTutorId(tutorId);
        chats.forEach(this::populateTransientFields);
        return chats;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Chat> findByStudentAccountId(String studentAccountId) {
        List<Chat> chats = chatJpaRepository.findByStudentAccountId(studentAccountId);
        chats.forEach(this::populateTransientFields);
        return chats;
    }

    @Override
    @Transactional(readOnly = true)
    public Chat findByTutorAndStudent(String tutorId, String studentAccountId) {
        Chat chat = chatJpaRepository.findDirectChat(tutorId, studentAccountId).orElse(null);
        if (chat != null) populateTransientFields(chat);
        return chat;
    }

    @Override
    @Transactional
    public void saveMessage(String chatId, ChatMessage message) {
        chatMessageJpaRepository.save(message);
    }

    @Override
    @Transactional
    public void updateMessage(String chatId, ChatMessage updated) {
        chatMessageJpaRepository.save(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessage> getMessages(String chatId) {
        return chatMessageJpaRepository.findByChatIdOrderByTimestampAsc(chatId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Chat> findGroupsByParticipantId(String participantId) {
        List<ChatParticipant> memberships = chatParticipantJpaRepository.findById_ParticipantId(participantId);
        List<String> chatIds = memberships.stream()
                .map(ChatParticipant::getChatId)
                .collect(Collectors.toList());
        if (chatIds.isEmpty()) return new ArrayList<>();

        List<Chat> groups = chatJpaRepository.findAllById(chatIds);
        groups.forEach(this::populateTransientFields);
        return groups;
    }

    /** No-op: participant management is handled by save() for GROUP chats. */
    @Override
    public void addToGroupIndex(String participantId, String chatId) {
        // handled by save(Chat) which syncs chat_participants
    }

    /** No-op: participant management is handled by save() for GROUP chats. */
    @Override
    public void removeFromGroupIndex(String participantId, String chatId) {
        // handled by save(Chat) which syncs chat_participants
    }

    private void populateTransientFields(Chat chat) {
        if (!chat.isGroup()) return;
        List<ChatParticipant> participants = chatParticipantJpaRepository.findById_ChatId(chat.getId());
        List<String> participantIds = new ArrayList<>();
        List<String> adminIds = new ArrayList<>();
        List<String> hiddenForMembers = new ArrayList<>();
        for (ChatParticipant cp : participants) {
            participantIds.add(cp.getParticipantId());
            if (cp.isAdmin()) adminIds.add(cp.getParticipantId());
            if (cp.isHidden()) hiddenForMembers.add(cp.getParticipantId());
        }
        chat.setParticipantIds(participantIds);
        chat.setAdminIds(adminIds);
        chat.setHiddenForMembers(hiddenForMembers);

        Map<String, String> names = new HashMap<>();
        for (String pid : participantIds) {
            tutorJpaRepository.findById(pid).ifPresentOrElse(
                t -> names.put(pid, t.getFullName()),
                () -> studentAccountJpaRepository.findById(pid).ifPresent(
                    s -> names.put(pid, (s.getFirstName() + " " + s.getLastName()).trim())
                )
            );
        }
        chat.setParticipantNames(names);
    }
}
