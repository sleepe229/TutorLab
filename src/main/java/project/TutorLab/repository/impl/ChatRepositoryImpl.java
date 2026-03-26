package project.TutorLab.repository.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;
import project.TutorLab.repository.ChatRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Repository
public class ChatRepositoryImpl implements ChatRepository {

    private static final String CHAT_KEY_PREFIX = "chat:";
    private static final String CHAT_TUTOR_PREFIX = "chat:tutor:";
    private static final String CHAT_STUDENT_PREFIX = "chat:student:";
    private static final String CHAT_MATCH_PREFIX = "chat:match:";
    private static final String CHAT_MESSAGES_PREFIX = "chat:messages:";
    private static final String CHAT_GROUP_PREFIX = "chat:group:";
    private static final long TTL_DAYS = 90;
    private static final int MAX_MESSAGES = 200;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public Chat save(Chat chat) {
        String key = CHAT_KEY_PREFIX + chat.getId();
        redisTemplate.opsForValue().set(key, chat, TTL_DAYS, TimeUnit.DAYS);

        if (chat.isGroup()) {
            // Group chats are indexed per participant via addToGroupIndex
            return chat;
        }

        String tutorSetKey = CHAT_TUTOR_PREFIX + chat.getTutorId();
        redisTemplate.opsForSet().add(tutorSetKey, chat.getId());
        redisTemplate.expire(tutorSetKey, TTL_DAYS, TimeUnit.DAYS);

        String studentSetKey = CHAT_STUDENT_PREFIX + chat.getStudentAccountId();
        redisTemplate.opsForSet().add(studentSetKey, chat.getId());
        redisTemplate.expire(studentSetKey, TTL_DAYS, TimeUnit.DAYS);

        String matchKey = CHAT_MATCH_PREFIX + chat.getTutorId() + ":" + chat.getStudentAccountId();
        redisTemplate.opsForValue().set(matchKey, chat.getId(), TTL_DAYS, TimeUnit.DAYS);

        return chat;
    }

    @Override
    public Chat findById(String id) {
        String key = CHAT_KEY_PREFIX + id;
        Object value = redisTemplate.opsForValue().get(key);
        if (value == null) return null;
        if (value instanceof Chat) return (Chat) value;
        try {
            return objectMapper.convertValue(value, Chat.class);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public List<Chat> findByTutorId(String tutorId) {
        String tutorSetKey = CHAT_TUTOR_PREFIX + tutorId;
        Set<Object> chatIds = redisTemplate.opsForSet().members(tutorSetKey);
        if (chatIds == null || chatIds.isEmpty()) return new ArrayList<>();
        List<Chat> result = new ArrayList<>();
        for (Object idObj : chatIds) {
            Chat chat = findById(idObj.toString());
            if (chat != null) result.add(chat);
        }
        return result;
    }

    @Override
    public List<Chat> findByStudentAccountId(String studentAccountId) {
        String studentSetKey = CHAT_STUDENT_PREFIX + studentAccountId;
        Set<Object> chatIds = redisTemplate.opsForSet().members(studentSetKey);
        if (chatIds == null || chatIds.isEmpty()) return new ArrayList<>();
        List<Chat> result = new ArrayList<>();
        for (Object idObj : chatIds) {
            Chat chat = findById(idObj.toString());
            if (chat != null) result.add(chat);
        }
        return result;
    }

    @Override
    public Chat findByTutorAndStudent(String tutorId, String studentAccountId) {
        String matchKey = CHAT_MATCH_PREFIX + tutorId + ":" + studentAccountId;
        Object chatIdObj = redisTemplate.opsForValue().get(matchKey);
        if (chatIdObj == null) return null;
        return findById(chatIdObj.toString());
    }

    @Override
    public void saveMessage(String chatId, ChatMessage message) {
        String listKey = CHAT_MESSAGES_PREFIX + chatId;
        redisTemplate.opsForList().rightPush(listKey, message);
        long size = redisTemplate.opsForList().size(listKey) != null
                ? redisTemplate.opsForList().size(listKey)
                : 0L;
        if (size > MAX_MESSAGES) {
            redisTemplate.opsForList().trim(listKey, size - MAX_MESSAGES, -1);
        }
        redisTemplate.expire(listKey, TTL_DAYS, TimeUnit.DAYS);
    }

    /**
     * Update an existing message in-place by scanning the list for a matching id.
     * Linear scan is acceptable: list is capped at MAX_MESSAGES (200).
     */
    @Override
    public void updateMessage(String chatId, ChatMessage updated) {
        String listKey = CHAT_MESSAGES_PREFIX + chatId;
        List<Object> rawList = redisTemplate.opsForList().range(listKey, 0, -1);
        if (rawList == null) return;
        for (int i = 0; i < rawList.size(); i++) {
            ChatMessage msg = toMessage(rawList.get(i));
            if (msg != null && updated.getId().equals(msg.getId())) {
                redisTemplate.opsForList().set(listKey, i, updated);
                return;
            }
        }
    }

    @Override
    public List<ChatMessage> getMessages(String chatId) {
        String listKey = CHAT_MESSAGES_PREFIX + chatId;
        List<Object> rawList = redisTemplate.opsForList().range(listKey, 0, -1);
        if (rawList == null || rawList.isEmpty()) return new ArrayList<>();
        List<ChatMessage> messages = new ArrayList<>();
        for (Object raw : rawList) {
            ChatMessage msg = toMessage(raw);
            if (msg != null) messages.add(msg);
        }
        return messages;
    }

    @Override
    public List<Chat> findGroupsByParticipantId(String participantId) {
        String groupSetKey = CHAT_GROUP_PREFIX + participantId;
        Set<Object> chatIds = redisTemplate.opsForSet().members(groupSetKey);
        if (chatIds == null || chatIds.isEmpty()) return new ArrayList<>();
        List<Chat> result = new ArrayList<>();
        for (Object idObj : chatIds) {
            Chat chat = findById(idObj.toString());
            if (chat != null) result.add(chat);
        }
        return result;
    }

    @Override
    public void addToGroupIndex(String participantId, String chatId) {
        String groupSetKey = CHAT_GROUP_PREFIX + participantId;
        redisTemplate.opsForSet().add(groupSetKey, chatId);
        redisTemplate.expire(groupSetKey, TTL_DAYS, TimeUnit.DAYS);
    }

    @Override
    public void removeFromGroupIndex(String participantId, String chatId) {
        String groupSetKey = CHAT_GROUP_PREFIX + participantId;
        redisTemplate.opsForSet().remove(groupSetKey, chatId);
    }

    private ChatMessage toMessage(Object raw) {
        if (raw instanceof ChatMessage) return (ChatMessage) raw;
        try {
            return objectMapper.convertValue(raw, ChatMessage.class);
        } catch (Exception e) {
            return null;
        }
    }
}
