package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * AI-generated lesson recap derived from a SessionSnapshot.
 * Derived data — NOT canonical. snapshotId is the PK and lookup key.
 */
@Entity
@Table(name = "lesson_recaps")
@JsonIgnoreProperties(ignoreUnknown = true)
public class LessonRecap implements Serializable {

    @Id
    @Column(name = "snapshot_id")
    private String snapshotId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "topics_covered", columnDefinition = "jsonb")
    private List<String> topicsCovered;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "struggled_with", columnDefinition = "jsonb")
    private List<String> struggledWith;

    @Column(name = "homework_assigned")
    private String homeworkAssigned;

    @Column(name = "next_session_focus")
    private String nextSessionFocus;

    @Column(name = "raw_response")
    private String rawResponse;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(name = "generation_failed", nullable = false)
    private boolean generationFailed;

    @Column(name = "attempt_count", nullable = false)
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
