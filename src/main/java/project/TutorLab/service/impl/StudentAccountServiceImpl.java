package project.TutorLab.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import project.TutorLab.config.JwtService;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.repository.StudentAccountRepository;
import project.TutorLab.service.StudentAccountService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class StudentAccountServiceImpl implements StudentAccountService {

    private static final String STUDENT_REFRESH_PREFIX = "student_refresh:";

    @Value("${app.jwt.refresh-ttl-days:30}")
    private long refreshTtlDays;

    @Autowired
    private StudentAccountRepository accountRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Override
    public Map<String, Object> register(String email, String password,
                                         String firstName, String lastName,
                                         String linkedStudentId) {
        if (accountRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already registered");
        }
        StudentAccount account = new StudentAccount(
                UUID.randomUUID().toString(),
                email,
                encoder.encode(password),
                firstName,
                lastName
        );
        if (linkedStudentId != null && !linkedStudentId.isBlank()) {
            account.getLinkedStudentIds().add(linkedStudentId);
        }
        accountRepository.save(account);
        return buildResponse(account);
    }

    @Override
    public Map<String, Object> login(String email, String password) {
        StudentAccount account = accountRepository.findByEmail(email);
        if (account == null || !encoder.matches(password, account.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        return buildResponse(account);
    }

    @Override
    public Map<String, Object> refresh(String refreshToken) {
        String key = STUDENT_REFRESH_PREFIX + refreshToken;
        Object accountIdVal = redisTemplate.opsForValue().get(key);
        if (accountIdVal == null) {
            throw new IllegalArgumentException("Invalid or expired refresh token");
        }
        String accountId = accountIdVal.toString();
        StudentAccount account = accountRepository.findById(accountId);
        if (account == null) {
            throw new IllegalArgumentException("Account not found");
        }
        redisTemplate.delete(key);
        String newRefresh = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(STUDENT_REFRESH_PREFIX + newRefresh, accountId,
                refreshTtlDays, TimeUnit.DAYS);

        Map<String, Object> resp = new HashMap<>();
        resp.put("accessToken", jwtService.generateStudentToken(account.getId()));
        resp.put("refreshToken", newRefresh);
        resp.put("studentAccountId", account.getId());
        return resp;
    }

    @Override
    public void logout(String refreshToken) {
        redisTemplate.delete(STUDENT_REFRESH_PREFIX + refreshToken);
    }

    @Override
    public StudentAccount getById(String id) {
        return accountRepository.findById(id);
    }

    @Override
    public void linkToStudent(String accountId, String studentId) {
        StudentAccount account = accountRepository.findById(accountId);
        if (account == null) throw new IllegalArgumentException("Account not found");
        List<String> ids = account.getLinkedStudentIds();
        if (!ids.contains(studentId)) {
            ids.add(studentId);
            account.setLinkedStudentIds(ids);
            accountRepository.save(account);
        }
    }

    private Map<String, Object> buildResponse(StudentAccount account) {
        String refreshToken = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
                STUDENT_REFRESH_PREFIX + refreshToken,
                account.getId(),
                refreshTtlDays, TimeUnit.DAYS);

        Map<String, Object> resp = new HashMap<>();
        resp.put("accessToken", jwtService.generateStudentToken(account.getId()));
        resp.put("refreshToken", refreshToken);
        resp.put("studentAccountId", account.getId());
        resp.put("email", account.getEmail());
        resp.put("firstName", account.getFirstName());
        resp.put("lastName", account.getLastName() != null ? account.getLastName() : "");
        resp.put("linkedStudentIds", account.getLinkedStudentIds());
        return resp;
    }
}
