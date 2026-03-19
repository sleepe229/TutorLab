package project.TutorLab.repository.impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.LessonRecap;
import project.TutorLab.repository.LessonRecapRepository;

import java.time.Duration;

/**
 * Redis key: lesson_recap:{snapshotId} → LessonRecap (365d TTL)
 * The snapshotId is the only lookup key — no secondary index needed.
 */
@Repository
public class LessonRecapRepositoryImpl implements LessonRecapRepository {

    private static final String PREFIX = "lesson_recap:";

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${app.snapshot.ttl-days:365}")
    private long snapshotTtlDays;

    public LessonRecapRepositoryImpl(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void save(LessonRecap recap) {
        redisTemplate.opsForValue().set(PREFIX + recap.getSnapshotId(), recap, Duration.ofDays(snapshotTtlDays));
    }

    @Override
    public LessonRecap findBySnapshotId(String snapshotId) {
        Object obj = redisTemplate.opsForValue().get(PREFIX + snapshotId);
        return obj instanceof LessonRecap ? (LessonRecap) obj : null;
    }
}
