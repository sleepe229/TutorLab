package project.TutorLab.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TutorLab.config.JwtService;
import project.TutorLab.dto.SnapshotSummaryDto;
import project.TutorLab.dto.StudentSessionHistoryDto;
import project.TutorLab.model.SessionSnapshot;
import project.TutorLab.model.Student;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.LessonRecapRepository;
import project.TutorLab.repository.SessionSnapshotRepository;
import project.TutorLab.repository.StudentAccountRepository;
import project.TutorLab.repository.StudentRepository;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.service.GoogleAuthService;
import project.TutorLab.service.StudentAccountService;

import java.util.ArrayList;
import java.util.Comparator;
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

    @Autowired
    private SessionSnapshotRepository sessionSnapshotRepository;

    @Autowired
    private LessonRecapRepository lessonRecapRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private TutorRepository tutorRepository;

    @Autowired
    private GoogleAuthService googleAuthService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Override
    public Map<String, Object> register(String email, String password,
                                         String firstName, String lastName,
                                         String linkedStudentId) {
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
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
    @Transactional
    public void linkToStudent(String accountId, String studentId) {
        StudentAccount account = accountRepository.findById(accountId);
        if (account == null) throw new IllegalArgumentException("Account not found");
        List<String> ids = account.getLinkedStudentIds();
        if (!ids.contains(studentId)) {
            ids.add(studentId);
            account.setLinkedStudentIds(ids);
            accountRepository.save(account);
        }
        // Also update the reverse link on the Student record
        Student student = studentRepository.findById(studentId);
        if (student != null && (student.getStudentAccountId() == null || student.getStudentAccountId().isBlank())) {
            student.setStudentAccountId(accountId);
            studentRepository.save(student);
        }
    }

    @Override
    public List<StudentSessionHistoryDto> getStudentHistory(String accountId) {
        StudentAccount account = accountRepository.findById(accountId);
        if (account == null) return new ArrayList<>();

        List<StudentSessionHistoryDto> result = new ArrayList<>();
        for (String studentId : account.getLinkedStudentIds()) {
            List<SessionSnapshot> snapshots = sessionSnapshotRepository.findByStudentId(studentId);
            if (snapshots.isEmpty()) continue;

            // Sort by endedAt descending
            snapshots.sort(Comparator.comparing(
                    s -> s.getEndedAt() != null ? s.getEndedAt() : java.time.LocalDateTime.MIN,
                    Comparator.reverseOrder()));

            Student student = studentRepository.findById(studentId);
            String firstName = student != null ? student.getFirstName()
                    : snapshots.get(0).getStudentFirstName();
            String lastName = student != null ? student.getLastName()
                    : snapshots.get(0).getStudentLastName();
            String tutorId = student != null ? student.getTutorId() : snapshots.get(0).getTutorId();
            Tutor tutor = tutorId != null ? tutorRepository.findById(tutorId) : null;

            List<SnapshotSummaryDto> summaries = new ArrayList<>();
            for (SessionSnapshot snap : snapshots) {
                SnapshotSummaryDto summary = new SnapshotSummaryDto();
                summary.setSnapshotId(snap.getId());
                summary.setTitle(snap.getTitle());
                summary.setEndedAt(snap.getEndedAt());
                summary.setDurationMinutes(snap.getDurationMinutes());
                summary.setSlideCount(snap.getSlideUrls() != null ? snap.getSlideUrls().size() : 0);
                summary.setHasRecap(lessonRecapRepository.findBySnapshotId(snap.getId()) != null);
                summaries.add(summary);
            }

            StudentSessionHistoryDto dto = new StudentSessionHistoryDto();
            dto.setStudentId(studentId);
            dto.setStudentFirstName(firstName);
            dto.setStudentLastName(lastName);
            dto.setTutorId(tutorId);
            dto.setTutorName(tutor != null ? tutor.getFullName() : null);
            dto.setSessions(summaries);
            result.add(dto);
        }
        return result;
    }

    @Override
    public Map<String, Object> updateAccount(String accountId, String firstName, String lastName,
                                              String currentPassword, String newPassword) {
        StudentAccount account = accountRepository.findById(accountId);
        if (account == null) throw new IllegalArgumentException("Account not found");

        if (firstName != null && !firstName.isBlank()) account.setFirstName(firstName.trim());
        if (lastName != null) account.setLastName(lastName.trim());

        if (newPassword != null && !newPassword.isBlank()) {
            if (currentPassword == null || !encoder.matches(currentPassword, account.getPasswordHash())) {
                throw new IllegalArgumentException("Current password is incorrect");
            }
            if (newPassword.length() < 8) {
                throw new IllegalArgumentException("Password must be at least 8 characters");
            }
            account.setPasswordHash(encoder.encode(newPassword));
        }

        accountRepository.save(account);
        Map<String, Object> result = new HashMap<>();
        result.put("firstName", account.getFirstName());
        result.put("lastName", account.getLastName() != null ? account.getLastName() : "");
        if (account.getPhotoUrl() != null) result.put("photoUrl", account.getPhotoUrl());
        return result;
    }

    @Override
    public Map<String, Object> updatePhotoUrl(String accountId, String photoUrl) {
        StudentAccount account = accountRepository.findById(accountId);
        if (account == null) throw new IllegalArgumentException("Account not found");
        account.setPhotoUrl(photoUrl);
        accountRepository.save(account);
        Map<String, Object> result = new HashMap<>();
        result.put("photoUrl", account.getPhotoUrl());
        return result;
    }

    @Override
    public Map<String, Object> googleAuth(String idToken) {
        GoogleAuthService.GoogleUserInfo info = googleAuthService.verify(idToken);

        // 1. Look up by Google sub
        StudentAccount account = accountRepository.findByGoogleId(info.sub());

        // 2. Fall back to email lookup (link existing password-based account)
        if (account == null && info.email() != null) {
            account = accountRepository.findByEmail(info.email().toLowerCase());
        }

        // 3. Create new account
        if (account == null) {
            String firstName = info.firstName() != null ? info.firstName()
                : (info.fullName() != null ? info.fullName() : "");
            account = new StudentAccount(
                UUID.randomUUID().toString(),
                info.email() != null ? info.email().toLowerCase() : info.sub() + "@google",
                null,  // no password for OAuth accounts
                firstName,
                info.lastName()
            );
            if (info.pictureUrl() != null) account.setPhotoUrl(info.pictureUrl());
        }

        // 4. Attach Google ID if not already set
        if (account.getGoogleId() == null) account.setGoogleId(info.sub());

        accountRepository.save(account);
        return buildResponse(account);
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
        if (account.getPhotoUrl() != null) resp.put("photoUrl", account.getPhotoUrl());
        return resp;
    }
}
