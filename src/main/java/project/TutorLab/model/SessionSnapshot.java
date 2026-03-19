package project.TutorLab.model;

import project.TutorLab.model.live.LiveSessionState;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Immutable historical artifact representing a completed lesson.
 *
 * Governance:
 *  - CANONICAL source of truth for lesson history. Written once on session end. Never mutated.
 *  - Corrections must create a new snapshot version, not modify this record.
 *  - Redis TTL: 365 days (configurable via app.snapshot.ttl-days).
 *  - Migration path: when Redis storage cost becomes a concern (>10K active students),
 *    offload slideDrawings to S3 and store only the S3 reference here.
 *
 * Redis keys:
 *   session_snapshot:{id}                        → this object (365d TTL)
 *   session_snapshot_idx:session:{sessionId}     → snapshotId (dedup key, 365d TTL)
 *   student:snapshots:{studentId}  SET            → contains snapshotId
 *   tutor:snapshots:{tutorId}      SET            → contains snapshotId
 *
 * Recap lookup: lesson_recap:{snapshotId} — snapshotId IS the recap key. No recapId in this object.
 */
public class SessionSnapshot implements Serializable {

    private String id;
    private String sessionId;
    private String tutorId;
    /** May be null if session ended without linking a student. */
    private String studentId;
    private String title;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private int durationMinutes;
    /** Deep copy of slideUrls at snapshot creation time. */
    private List<String> slideUrls;
    /** Deep copy of all slide drawings at snapshot creation time. */
    private Map<Integer, List<LiveSessionState.DrawPath>> slideDrawings;
    /**
     * Denormalized student name — preserved even if student:{studentId} TTL expires.
     * Set from student profile at snapshot creation time.
     */
    private String studentFirstName;
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
