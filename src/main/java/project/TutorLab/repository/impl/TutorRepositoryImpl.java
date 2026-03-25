package project.TutorLab.repository.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.TutorRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Repository
public class TutorRepositoryImpl implements TutorRepository {

    private static final String TUTOR_KEY_PREFIX = "tutor:";
    private static final String TUTOR_LOGIN_INDEX_PREFIX = "tutor:login:";
    private static final String TUTOR_GOOGLE_INDEX_PREFIX = "tutor:google:";
    private static final String TUTOR_EMAIL_INDEX_PREFIX = "tutor:email:";
    private static final String TUTOR_PUBLIC_INDEX = "tutor:public";

    @Value("${app.tutor.ttl-days:30}")
    private long ttlDays;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public Tutor save(Tutor tutor) {
        // Проверяем, существует ли уже репетитор с таким ID
        Tutor existingTutor = findById(tutor.getId());
        
        // Если логин изменился, удаляем старый индекс
        if (existingTutor != null && existingTutor.getLogin() != null
            && !existingTutor.getLogin().equals(tutor.getLogin())) {
            String oldLoginIndexKey = TUTOR_LOGIN_INDEX_PREFIX + existingTutor.getLogin();
            redisTemplate.delete(oldLoginIndexKey);
        }

        String key = TUTOR_KEY_PREFIX + tutor.getId();
        redisTemplate.opsForValue().set(key, tutor, ttlDays, TimeUnit.DAYS);

        // Создаем/обновляем индекс для поиска по логину
        if (tutor.getLogin() != null && !tutor.getLogin().isEmpty()) {
            String loginIndexKey = TUTOR_LOGIN_INDEX_PREFIX + tutor.getLogin();
            redisTemplate.opsForValue().set(loginIndexKey, tutor.getId(), ttlDays, TimeUnit.DAYS);
        }

        // Google OAuth index
        if (tutor.getGoogleId() != null && !tutor.getGoogleId().isBlank()) {
            redisTemplate.opsForValue().set(
                TUTOR_GOOGLE_INDEX_PREFIX + tutor.getGoogleId(), tutor.getId(), ttlDays, TimeUnit.DAYS);
        }

        // Email index (for OAuth accounts)
        if (tutor.getEmail() != null && !tutor.getEmail().isBlank()) {
            redisTemplate.opsForValue().set(
                TUTOR_EMAIL_INDEX_PREFIX + tutor.getEmail().toLowerCase(), tutor.getId(), ttlDays, TimeUnit.DAYS);
        }

        // Maintain public profile index
        if (tutor.isPublicProfile()) {
            redisTemplate.opsForSet().add(TUTOR_PUBLIC_INDEX, tutor.getId());
        } else {
            redisTemplate.opsForSet().remove(TUTOR_PUBLIC_INDEX, tutor.getId());
        }

        return tutor;
    }

    @Override
    public Tutor findById(String id) {
        String key = TUTOR_KEY_PREFIX + id;
        Object value = redisTemplate.opsForValue().get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Tutor) {
            return (Tutor) value;
        }
        try {
            return objectMapper.convertValue(value, Tutor.class);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public void deleteById(String id) {
        Tutor tutor = findById(id);
        if (tutor != null) {
            if (tutor.getLogin() != null) {
                redisTemplate.delete(TUTOR_LOGIN_INDEX_PREFIX + tutor.getLogin());
            }
            if (tutor.getGoogleId() != null) {
                redisTemplate.delete(TUTOR_GOOGLE_INDEX_PREFIX + tutor.getGoogleId());
            }
            if (tutor.getEmail() != null) {
                redisTemplate.delete(TUTOR_EMAIL_INDEX_PREFIX + tutor.getEmail().toLowerCase());
            }
        }
        redisTemplate.delete(TUTOR_KEY_PREFIX + id);
    }

    @Override
    public boolean existsById(String id) {
        String key = TUTOR_KEY_PREFIX + id;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    @Override
    public Tutor findByLogin(String login) {
        // Используем индекс для быстрого поиска
        String loginIndexKey = TUTOR_LOGIN_INDEX_PREFIX + login;
        Object tutorIdObj = redisTemplate.opsForValue().get(loginIndexKey);
        
        if (tutorIdObj == null) {
            return null;
        }
        
        String tutorId;
        if (tutorIdObj instanceof String) {
            tutorId = (String) tutorIdObj;
        } else {
            tutorId = tutorIdObj.toString();
        }
        
        return findById(tutorId);
    }

    @Override
    public boolean existsByLogin(String login) {
        return findByLogin(login) != null;
    }

    @Override
    public Tutor findByGoogleId(String googleId) {
        Object idVal = redisTemplate.opsForValue().get(TUTOR_GOOGLE_INDEX_PREFIX + googleId);
        if (idVal == null) return null;
        return findById(idVal.toString());
    }

    @Override
    public Tutor findByEmail(String email) {
        Object idVal = redisTemplate.opsForValue().get(TUTOR_EMAIL_INDEX_PREFIX + email.toLowerCase());
        if (idVal == null) return null;
        return findById(idVal.toString());
    }

    @Override
    public List<Tutor> findAllPublic() {
        Set<Object> ids = redisTemplate.opsForSet().members(TUTOR_PUBLIC_INDEX);
        if (ids == null || ids.isEmpty()) return new ArrayList<>();
        List<Tutor> result = new ArrayList<>();
        for (Object idObj : ids) {
            String id = idObj.toString();
            Tutor t = findById(id);
            if (t != null && t.isPublicProfile()) {
                result.add(t);
            } else {
                // Prune expired or opted-out tutor IDs from the index
                redisTemplate.opsForSet().remove(TUTOR_PUBLIC_INDEX, id);
            }
        }
        return result;
    }
}

