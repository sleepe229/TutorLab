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

    @Test
    void getSession_unknownId_returnsNull() {
        when(valueOperations.get("live:session:nonexistent")).thenReturn(null);
        assertNull(liveSessionService.getSession("nonexistent"));
    }

    @Test
    void getSession_wrongType_returnsNull() {
        // If Redis returns something unexpected (e.g. a String), should return null
        when(valueOperations.get("live:session:wrong")).thenReturn("not-a-state");
        assertNull(liveSessionService.getSession("wrong"));
    }

    @Test
    void addSlides_setsUrlsAndResetsToSlideZero() {
        LiveSessionState state = new LiveSessionState();
        state.setSessionId("sess1");
        state.setSlideUrls(new ArrayList<>());
        state.setSlideDrawings(new HashMap<>());
        state.setCurrentSlideIndex(3);

        when(valueOperations.get("live:session:sess1")).thenReturn(state);

        List<String> slides = List.of("/slides/1.png", "/slides/2.png");
        liveSessionService.addSlides("sess1", slides);

        verify(valueOperations).set(eq("live:session:sess1"), argThat(s ->
                s instanceof LiveSessionState
                && ((LiveSessionState) s).getSlideUrls().size() == 2
                && ((LiveSessionState) s).getCurrentSlideIndex() == 0
        ), any());
    }

    @Test
    void addSlides_sessionNotFound_doesNothing() {
        when(valueOperations.get("live:session:missing")).thenReturn(null);
        liveSessionService.addSlides("missing", List.of("/slide.png"));
        // Should not throw and should not call set
        verify(valueOperations, never()).set(eq("live:session:missing"), any(), any());
    }

    @Test
    void deleteSession_removesSessionAndTutorIndex() {
        LiveSessionState state = new LiveSessionState();
        state.setSessionId("sess-del");
        state.setTutorId("tutor-del");
        state.setSlideUrls(new ArrayList<>());
        state.setSlideDrawings(new HashMap<>());

        when(valueOperations.get("live:session:sess-del")).thenReturn(state);
        when(valueOperations.get("live:session:tutor:tutor-del")).thenReturn("sess-del");

        liveSessionService.deleteSession("sess-del");

        verify(redisTemplate).delete("live:session:tutor:tutor-del");
        verify(redisTemplate).delete("live:session:sess-del");
    }

    @Test
    void deleteSession_tutorIndexPointsDifferentSession_doesNotDeleteTutorIndex() {
        LiveSessionState state = new LiveSessionState();
        state.setSessionId("sess-A");
        state.setTutorId("tutor-1");
        state.setSlideUrls(new ArrayList<>());
        state.setSlideDrawings(new HashMap<>());

        when(valueOperations.get("live:session:sess-A")).thenReturn(state);
        // Tutor index points to a different session (e.g. tutor started a new session)
        when(valueOperations.get("live:session:tutor:tutor-1")).thenReturn("sess-B");

        liveSessionService.deleteSession("sess-A");

        verify(redisTemplate, never()).delete("live:session:tutor:tutor-1");
        verify(redisTemplate).delete("live:session:sess-A");
    }

    @Test
    void getSessionByTutor_validTutor_returnsSession() {
        LiveSessionState state = new LiveSessionState();
        state.setSessionId("sess1");
        state.setTutorId("tutor-1");
        state.setSlideUrls(new ArrayList<>());
        state.setSlideDrawings(new HashMap<>());

        when(valueOperations.get("live:session:tutor:tutor-1")).thenReturn("sess1");
        when(valueOperations.get("live:session:sess1")).thenReturn(state);

        LiveSessionState result = liveSessionService.getSessionByTutor("tutor-1");

        assertNotNull(result);
        assertEquals("sess1", result.getSessionId());
    }

    @Test
    void getSessionByTutor_noSession_returnsNull() {
        when(valueOperations.get("live:session:tutor:tutor-X")).thenReturn(null);
        assertNull(liveSessionService.getSessionByTutor("tutor-X"));
    }

    @Test
    void updateSlide_sessionNotFound_doesNothing() {
        when(valueOperations.get("live:session:missing")).thenReturn(null);
        liveSessionService.updateSlide("missing", 5);
        verify(valueOperations, never()).set(eq("live:session:missing"), any(), any());
    }

    @Test
    void createSession_nullTitle_usesDefaultTitle() {
        doNothing().when(valueOperations).set(anyString(), any(), any());

        LiveSessionState state = liveSessionService.createSession("tutor1", null);

        assertEquals("Новый урок", state.getTitle());
    }
}
