package project.TutorLab.repository.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.SessionSnapshot;
import project.TutorLab.repository.SessionSnapshotRepository;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Redis key patterns:
 *   session_snapshot:{snapshotId}                    → SessionSnapshot object (365d TTL)
 *   session_snapshot_idx:session:{sessionId}         → snapshotId String (dedup, 365d TTL)
 *   student:snapshots:{studentId}                    → SET of snapshotIds (365d TTL)
 *   tutor:snapshots:{tutorId}                        → SET of snapshotIds (365d TTL)
 *
 * Governance: Redis is treated as long-lived cache here (365d TTL), not permanent storage.
 * Migration path: at >10K active students, export snapshot objects to S3 JSON and use
 * Redis only for the index SETs and dedup keys.
 */
@Repository
public class SessionSnapshotRepositoryImpl implements SessionSnapshotRepository {

    private static final Logger log = LoggerFactory.getLogger(SessionSnapshotRepositoryImpl.class);

    private static final String PREFIX = "session_snapshot:";
    private static final String IDX_PREFIX = "session_snapshot_idx:session:";
    private static final String STUDENT_SET_PREFIX = "student:snapshots:";
    private static final String TUTOR_SET_PREFIX = "tutor:snapshots:";

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${app.snapshot.ttl-days:365}")
    private long snapshotTtlDays;

    public SessionSnapshotRepositoryImpl(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void save(SessionSnapshot snapshot) {
        Duration ttl = Duration.ofDays(snapshotTtlDays);
        String key = PREFIX + snapshot.getId();
        redisTemplate.opsForValue().set(key, snapshot, ttl);

        // Dedup index: sessionId → snapshotId
        redisTemplate.opsForValue().set(IDX_PREFIX + snapshot.getSessionId(), snapshot.getId(), ttl);

        // Student index (only if linked)
        if (snapshot.getStudentId() != null && !snapshot.getStudentId().isBlank()) {
            redisTemplate.opsForSet().add(STUDENT_SET_PREFIX + snapshot.getStudentId(), snapshot.getId());
            redisTemplate.expire(STUDENT_SET_PREFIX + snapshot.getStudentId(), snapshotTtlDays, TimeUnit.DAYS);
        }

        // Tutor index
        redisTemplate.opsForSet().add(TUTOR_SET_PREFIX + snapshot.getTutorId(), snapshot.getId());
        redisTemplate.expire(TUTOR_SET_PREFIX + snapshot.getTutorId(), snapshotTtlDays, TimeUnit.DAYS);
    }

    @Override
    public SessionSnapshot findById(String snapshotId) {
        Object obj = redisTemplate.opsForValue().get(PREFIX + snapshotId);
        return obj instanceof SessionSnapshot ? (SessionSnapshot) obj : null;
    }

    @Override
    public String findSnapshotIdBySessionId(String sessionId) {
        Object obj = redisTemplate.opsForValue().get(IDX_PREFIX + sessionId);
        return obj instanceof String ? (String) obj : null;
    }

    @Override
    public List<SessionSnapshot> findByStudentId(String studentId) {
        return fetchBySet(STUDENT_SET_PREFIX + studentId);
    }

    @Override
    public List<SessionSnapshot> findByTutorId(String tutorId) {
        return fetchBySet(TUTOR_SET_PREFIX + tutorId);
    }

    /** Batch-fetch snapshots from a Redis SET index using pipelining. */
    private List<SessionSnapshot> fetchBySet(String setKey) {
        Set<Object> ids = redisTemplate.opsForSet().members(setKey);
        if (ids == null || ids.isEmpty()) return new ArrayList<>();

        List<String> keys = ids.stream()
                .filter(id -> id instanceof String)
                .map(id -> PREFIX + id)
                .toList();

        List<Object> values = redisTemplate.opsForValue().multiGet(keys);
        List<SessionSnapshot> result = new ArrayList<>();
        if (values != null) {
            for (Object v : values) {
                if (v instanceof SessionSnapshot s) {
                    result.add(s);
                }
            }
        }
        return result;
    }
}
