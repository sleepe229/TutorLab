package project.TutorLab.model;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * AI-generated lesson recap derived from a SessionSnapshot.
 *
 * Governance:
 *  - Derived data — NOT canonical. Canonical source is SessionSnapshot.
 *  - Redis key: lesson_recap:{snapshotId} — snapshotId IS the lookup key.
 *    No reference to this key is stored in SessionSnapshot (immutability preserved).
 *  - TTL: 365 days (same lifecycle as snapshot).
 *  - Retry: attemptCount tracks how many generation attempts occurred.
 *    If generationFailed=true, the record is eligible for manual re-trigger.
 */
public class LessonRecap implements Serializable {

    private String snapshotId;
    private List<String> topicsCovered;
    private List<String> struggledWith;
    private String homeworkAssigned;
    private String nextSessionFocus;
    /** Raw Claude response, kept for audit/debugging. */
    private String rawResponse;
    private LocalDateTime generatedAt;
    private boolean generationFailed;
    /** Number of generation attempts made (including retries). */
    private int attemptCount;

    public LessonRecap() {}

    public String getSnapshotId() { return snapshotId; }
    public void setSnapshotId(String snapshotId) { this.snapshotId = snapshotId; }

    public List<String> getTopicsCovered() { return topicsCovered; }
    public void setTopicsCovered(List<String> topicsCovered) { this.topicsCovered = topicsCovered; }

    public List<String> getStruggledWith() { return struggledWith; }
    public void setStruggledWith(List<String> struggledWith) { this.struggledWith = struggledWith; }

    public String getHomeworkAssigned() { return homeworkAssigned; }
    public void setHomeworkAssigned(String homeworkAssigned) { this.homeworkAssigned = homeworkAssigned; }

    public String getNextSessionFocus() { return nextSessionFocus; }
    public void setNextSessionFocus(String nextSessionFocus) { this.nextSessionFocus = nextSessionFocus; }

    public String getRawResponse() { return rawResponse; }
    public void setRawResponse(String rawResponse) { this.rawResponse = rawResponse; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }

    public boolean isGenerationFailed() { return generationFailed; }
    public void setGenerationFailed(boolean generationFailed) { this.generationFailed = generationFailed; }

    public int getAttemptCount() { return attemptCount; }
    public void setAttemptCount(int attemptCount) { this.attemptCount = attemptCount; }
}
