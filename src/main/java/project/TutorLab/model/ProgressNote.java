package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Tutor-authored qualitative progress note embedded in Student.
 * Embedded in student:{studentId} — no separate Redis key.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProgressNote implements Serializable {

    private String id;
    /** Optional link to the session snapshot this note relates to. */
    private String snapshotId;
    private LocalDateTime date;
    private String noteText;
    /** Free-text skill tags e.g. ["algebra", "fractions"]. */
    private List<String> skillTags;
    /** 1=struggling, 5=mastered. */
    private int rating;

    public ProgressNote() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSnapshotId() { return snapshotId; }
    public void setSnapshotId(String snapshotId) { this.snapshotId = snapshotId; }

    public LocalDateTime getDate() { return date; }
    public void setDate(LocalDateTime date) { this.date = date; }

    public String getNoteText() { return noteText; }
    public void setNoteText(String noteText) { this.noteText = noteText; }

    public List<String> getSkillTags() { return skillTags; }
    public void setSkillTags(List<String> skillTags) { this.skillTags = skillTags; }

    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
}
