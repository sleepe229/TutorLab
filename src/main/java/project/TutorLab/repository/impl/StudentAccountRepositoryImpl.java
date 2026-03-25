package project.TutorLab.repository.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.repository.StudentAccountRepository;

import java.util.concurrent.TimeUnit;

@Repository
public class StudentAccountRepositoryImpl implements StudentAccountRepository {

    private static final String ACCOUNT_PREFIX = "student_account:";
    private static final String EMAIL_INDEX_PREFIX = "student_account_email:";
    private static final String GOOGLE_INDEX_PREFIX = "student_account_google:";

    @Value("${app.student.ttl-days:30}")
    private long ttlDays;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public StudentAccount save(StudentAccount account) {
        String key = ACCOUNT_PREFIX + account.getId();
        redisTemplate.opsForValue().set(key, account, ttlDays, TimeUnit.DAYS);
        if (account.getEmail() != null) {
            redisTemplate.opsForValue().set(
                EMAIL_INDEX_PREFIX + account.getEmail().toLowerCase(), account.getId(), ttlDays, TimeUnit.DAYS);
        }
        if (account.getGoogleId() != null && !account.getGoogleId().isBlank()) {
            redisTemplate.opsForValue().set(
                GOOGLE_INDEX_PREFIX + account.getGoogleId(), account.getId(), ttlDays, TimeUnit.DAYS);
        }
        return account;
    }

    @Override
    public StudentAccount findById(String id) {
        Object value = redisTemplate.opsForValue().get(ACCOUNT_PREFIX + id);
        if (value == null) return null;
        if (value instanceof StudentAccount) return (StudentAccount) value;
        try {
            return objectMapper.convertValue(value, StudentAccount.class);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public StudentAccount findByEmail(String email) {
        Object idVal = redisTemplate.opsForValue().get(EMAIL_INDEX_PREFIX + email.toLowerCase());
        if (idVal == null) return null;
        return findById(idVal.toString());
    }

    @Override
    public StudentAccount findByGoogleId(String googleId) {
        Object idVal = redisTemplate.opsForValue().get(GOOGLE_INDEX_PREFIX + googleId);
        if (idVal == null) return null;
        return findById(idVal.toString());
    }

    @Override
    public boolean existsByEmail(String email) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(EMAIL_INDEX_PREFIX + email.toLowerCase()));
    }
}
