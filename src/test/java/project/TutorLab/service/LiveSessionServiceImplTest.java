package project.TutorLab.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import project.TutorLab.model.live.LiveSessionState;
import project.TutorLab.service.impl.LiveSessionServiceImpl;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LiveSessionServiceImplTest {

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    @InjectMocks
    private LiveSessionServiceImpl liveSessionService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void createSession_returnsStateWithId() {
        doNothing().when(valueOperations).set(anyString(), any(), any());

        LiveSessionState state = liveSessionService.createSession("tutor1", "Test Lesson");

        assertNotNull(state.getSessionId());
        assertEquals("tutor1", state.getTutorId());
        assertEquals("Test Lesson", state.getTitle());
        assertEquals(0, state.getCurrentSlideIndex());
    }

    @Test
    void updateSlide_changesIndex() {
        LiveSessionState state = new LiveSessionState();
        state.setSessionId("sess1");
        state.setCurrentSlideIndex(0);
        state.setSlideUrls(new ArrayList<>());
        state.setSlideDrawings(new HashMap<>());

        when(valueOperations.get("live:session:sess1")).thenReturn(state);

        liveSessionService.updateSlide("sess1", 3);

        verify(valueOperations).set(eq("live:session:sess1"), argThat(s ->
                s instanceof LiveSessionState && ((LiveSessionState) s).getCurrentSlideIndex() == 3
        ), any());
    }

    @Test
    void addDrawPath_appendsToSlide() {
        LiveSessionState state = new LiveSessionState();
        state.setSessionId("sess1");
        state.setSlideDrawings(new HashMap<>());
        state.setSlideUrls(new ArrayList<>());

        when(valueOperations.get("live:session:sess1")).thenReturn(state);

        LiveSessionState.DrawPath path = new LiveSessionState.DrawPath();
        path.setPathId("path1");

        liveSessionService.addDrawPath("sess1", 0, path);

        verify(valueOperations).set(eq("live:session:sess1"), argThat(s ->
                s instanceof LiveSessionState &&
                ((LiveSessionState) s).getSlideDrawings().get(0) != null &&
                ((LiveSessionState) s).getSlideDrawings().get(0).size() == 1
        ), any());
    }

    @Test
    void clearSlideDrawings_removesDrawings() {
        LiveSessionState state = new LiveSessionState();
        state.setSessionId("sess1");
        state.setSlideUrls(new ArrayList<>());
        HashMap<Integer, List<LiveSessionState.DrawPath>> drawings = new HashMap<>();
        drawings.put(0, new ArrayList<>());
        state.setSlideDrawings(drawings);

        when(valueOperations.get("live:session:sess1")).thenReturn(state);

        liveSessionService.clearSlideDrawings("sess1", 0);

        verify(valueOperations).set(eq("live:session:sess1"), argThat(s ->
                s instanceof LiveSessionState &&
                !((LiveSessionState) s).getSlideDrawings().containsKey(0)
        ), any());
    }
}
