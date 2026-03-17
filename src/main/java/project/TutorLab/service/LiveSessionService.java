package project.TutorLab.service;

import project.TutorLab.model.live.LiveSessionState;

import java.util.List;

public interface LiveSessionService {
    LiveSessionState createSession(String tutorId, String title);
    LiveSessionState getSession(String sessionId);
    void updateSlide(String sessionId, int slideIndex);
    void addSlides(String sessionId, List<String> slideUrls);
    void updateSession(LiveSessionState session);
    void addDrawPath(String sessionId, int slideIndex, LiveSessionState.DrawPath path);
    void clearSlideDrawings(String sessionId, int slideIndex);
    void deleteSession(String sessionId);
}
