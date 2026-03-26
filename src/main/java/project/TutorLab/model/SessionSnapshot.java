package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import project.TutorLab.model.live.LiveSessionState;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Immutable historical artifact representing a completed lesson.
 * Written once on session end. Never mutated.
 */
@Entity
@Table(name = "session_snapshots")
@JsonIgnoreProperties(ignoreUnknown = true)
public class SessionSnapshot implements Serializable {

    @Id
    private String id;

    @Column(name = "session_id", unique = true)
    private String sessionId;

    @Column(name = "tutor_id")
    private String tutorId;

    @Column(name = "student_id")
    private String studentId;

    private String title;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "duration_minutes")
    private int durationMinutes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "slide_urls", columnDefinition = "jsonb")
    private List<String> slideUrls;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "slide_drawings", columnDefinition = "jsonb")
    private Map<Integer, List<LiveSessionState.DrawPath>> slideDrawings;

    @Column(name = "student_first_name")
    private String studentFirstName;

    @Column(name = "student_last_name")
    private String studentLastName;

    public SessionSnapshot() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getTutorId() { return tutorId; }
    public void setTutorId(String tutorId) { this.tutorId = tutorId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }

    public LocalDateTime getEndedAt() { return endedAt; }
    public void setEndedAt(LocalDateTime endedAt) { this.endedAt = endedAt; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public List<String> getSlideUrls() { return slideUrls; }
    public void setSlideUrls(List<String> slideUrls) { this.slideUrls = slideUrls; }

    public Map<Integer, List<LiveSessionState.DrawPath>> getSlideDrawings() { return slideDrawings; }
    public void setSlideDrawings(Map<Integer, List<LiveSessionState.DrawPath>> slideDrawings) {
        this.slideDrawings = slideDrawings;
    }

    public String getStudentFirstName() { return studentFirstName; }
    public void setStudentFirstName(String studentFirstName) { this.studentFirstName = studentFirstName; }

    public String getStudentLastName() { return studentLastName; }
    public void setStudentLastName(String studentLastName) { this.studentLastName = studentLastName; }
}
