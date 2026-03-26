package project.TutorLab.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import project.TutorLab.model.live.LiveSessionState;
import project.TutorLab.service.LiveSessionService;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class LiveSessionServiceImpl implements LiveSessionService {

    private static final String KEY_PREFIX = "live:session:";

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Value("${app.live-session.ttl-hours:6}")
    private long sessionTtlHours;

    @Override
    public LiveSessionState createSession(String tutorId, String title) {
        String id = UUID.randomUUID().toString();
        LiveSessionState state = new LiveSessionState();
        state.setSessionId(id);
        state.setTutorId(tutorId);
        state.setTitle(title != null ? title : "Новый урок");
        state.setCurrentSlideIndex(0);
        state.setSlideUrls(new ArrayList<>());
        state.setSlideDrawings(new HashMap<>());
        state.setStartedAt(LocalDateTime.now());

        saveSession(state);
        return state;
    }

    @Override
    public LiveSessionState getSession(String sessionId) {
        String key = KEY_PREFIX + sessionId;
        Object obj = redisTemplate.opsForValue().get(key);
        return obj instanceof LiveSessionState ? (LiveSessionState) obj : null;
    }

    @Override
    public void updateSlide(String sessionId, int slideIndex) {
        LiveSessionState state = getSession(sessionId);
        if (state == null)
            return;
        state.setCurrentSlideIndex(slideIndex);
        saveSession(state);
    }

    @Override
    public void addSlides(String sessionId, List<String> slideUrls) {
        LiveSessionState state = getSession(sessionId);
        if (state == null)
            return;
        state.setSlideUrls(slideUrls);
        state.setCurrentSlideIndex(0);
        saveSession(state);
    }

    @Override
    public void updateSession(LiveSessionState session) {
        if (session != null) {
            saveSession(session);
        }
    }

    @Override
    public void addDrawPath(String sessionId, int slideIndex, LiveSessionState.DrawPath path) {
        LiveSessionState state = getSession(sessionId);
        if (state == null)
            return;

        state.getSlideDrawings()
                .computeIfAbsent(slideIndex, k -> new ArrayList<>())
                .add(path);

        saveSession(state);
    }

    @Override
    public void clearSlideDrawings(String sessionId, int slideIndex) {
        LiveSessionState state = getSession(sessionId);
        if (state == null)
            return;

        state.getSlideDrawings().remove(slideIndex);
        saveSession(state);
    }

    @Override
    public void deleteSession(String sessionId) {
        LiveSessionState state = getSession(sessionId);
        if (state != null) {
            String tutorKey = "live:session:tutor:" + state.getTutorId();
            Object currentSessionIdObj = redisTemplate.opsForValue().get(tutorKey);
            if (currentSessionIdObj instanceof String
                    && state.getSessionId().equals(currentSessionIdObj)) {
                redisTemplate.delete(tutorKey);
            }
        }
        String key = KEY_PREFIX + sessionId;
        redisTemplate.delete(key);
    }

    @Override
    public LiveSessionState getSessionByTutor(String tutorId) {
        String tutorKey = "live:session:tutor:" + tutorId;
        Object sessionIdObj = redisTemplate.opsForValue().get(tutorKey);
        if (!(sessionIdObj instanceof String)) return null;
        return getSession((String) sessionIdObj);
    }

    @SuppressWarnings("null")
    private void saveSession(LiveSessionState state) {
        Duration duration = Duration.ofHours(sessionTtlHours);
        redisTemplate.opsForValue().set(KEY_PREFIX + state.getSessionId(), state, duration);
        // Keep the tutor→sessionId index TTL in sync so getSessionByTutor() never
        // returns null while the session itself is still alive.
        redisTemplate.opsForValue().set("live:session:tutor:" + state.getTutorId(), state.getSessionId(), duration);
    }
}
