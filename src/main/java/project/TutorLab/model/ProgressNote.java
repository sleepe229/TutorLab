package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "progress_notes")
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProgressNote implements Serializable {

    @Id
    private String id;

    // Managed by Student's @JoinColumn; insertable/updatable=false prevents conflicts
    @Column(name = "student_id", insertable = false, updatable = false)
    private String studentId;

    @Column(name = "snapshot_id")
    private String snapshotId;

    @Column(name = "note_date")
    private LocalDateTime date;

    @Column(name = "note_text")
    private String noteText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "skill_tags", columnDefinition = "jsonb")
    private List<String> skillTags = new ArrayList<>();

    private Integer rating;

    public ProgressNote() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getSnapshotId() { return snapshotId; }
    public void setSnapshotId(String snapshotId) { this.snapshotId = snapshotId; }

    public LocalDateTime getDate() { return date; }
    public void setDate(LocalDateTime date) { this.date = date; }

    public String getNoteText() { return noteText; }
    public void setNoteText(String noteText) { this.noteText = noteText; }

    public List<String> getSkillTags() { return skillTags; }
    public void setSkillTags(List<String> skillTags) { this.skillTags = skillTags; }

    public int getRating() { return rating != null ? rating : 0; }
    public void setRating(int rating) { this.rating = rating; }
}
