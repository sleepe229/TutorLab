package project.TutorLab.dto;

import java.time.LocalDateTime;

public class SnapshotSummaryDto {
    private String snapshotId;
    private String title;
    private LocalDateTime endedAt;
    private int durationMinutes;
    private int slideCount;
    /** True if a LessonRecap has been stored for this snapshot. */
    private boolean hasRecap;

    public SnapshotSummaryDto() {}

    public String getSnapshotId() { return snapshotId; }
    public void setSnapshotId(String snapshotId) { this.snapshotId = snapshotId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public LocalDateTime getEndedAt() { return endedAt; }
    public void setEndedAt(LocalDateTime endedAt) { this.endedAt = endedAt; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public int getSlideCount() { return slideCount; }
    public void setSlideCount(int slideCount) { this.slideCount = slideCount; }

    public boolean isHasRecap() { return hasRecap; }
    public void setHasRecap(boolean hasRecap) { this.hasRecap = hasRecap; }
}
