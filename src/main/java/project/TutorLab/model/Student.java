package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "students")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Student {

    @Id
    private String id;

    @Column(name = "tutor_id", nullable = false)
    private String tutorId;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    private Integer age;

    @Column(name = "photo_url")
    private String photoUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> interests;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "material_urls", columnDefinition = "jsonb")
    private List<String> materialUrls;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lesson_dates", columnDefinition = "jsonb")
    private List<String> lessonDates;

    /** key = lesson date string (e.g. "2026-03-17"), value = list of material URLs */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lesson_materials", columnDefinition = "jsonb")
    private Map<String, List<String>> lessonMaterials;

    @Column(name = "price_per_lesson")
    private Integer pricePerLesson;

    @Column(name = "trial_lessons_count", nullable = false)
    private int trialLessonsCount = 1;

    /** key = lesson date string, value = PENDING|PAID_EXTERNAL|PAID_PLATFORM|TRIAL */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lesson_payments", columnDefinition = "jsonb")
    private Map<String, String> lessonPayments;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    @OrderBy("date DESC")
    private List<ProgressNote> progressNotes = new ArrayList<>();

    @Column(name = "student_account_id")
    private String studentAccountId;

    public Student() {}

    public Student(String id, String tutorId, String firstName, String lastName, Integer age) {
        this.id = id;
        this.tutorId = tutorId;
        this.firstName = firstName;
        this.lastName = lastName;
        this.age = age;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTutorId() { return tutorId; }
    public void setTutorId(String tutorId) { this.tutorId = tutorId; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public List<String> getInterests() { return interests; }
    public void setInterests(List<String> interests) { this.interests = interests; }

    public List<String> getMaterialUrls() { return materialUrls; }
    public void setMaterialUrls(List<String> materialUrls) { this.materialUrls = materialUrls; }

    public List<String> getLessonDates() { return lessonDates; }
    public void setLessonDates(List<String> lessonDates) { this.lessonDates = lessonDates; }

    public Map<String, List<String>> getLessonMaterials() { return lessonMaterials; }
    public void setLessonMaterials(Map<String, List<String>> lessonMaterials) { this.lessonMaterials = lessonMaterials; }

    public Integer getPricePerLesson() { return pricePerLesson; }
    public void setPricePerLesson(Integer pricePerLesson) { this.pricePerLesson = pricePerLesson; }

    public int getTrialLessonsCount() { return trialLessonsCount; }
    public void setTrialLessonsCount(int trialLessonsCount) { this.trialLessonsCount = trialLessonsCount; }

    public Map<String, String> getLessonPayments() { return lessonPayments; }
    public void setLessonPayments(Map<String, String> lessonPayments) { this.lessonPayments = lessonPayments; }

    public List<ProgressNote> getProgressNotes() {
        if (progressNotes == null) progressNotes = new ArrayList<>();
        return progressNotes;
    }
    public void setProgressNotes(List<ProgressNote> progressNotes) { this.progressNotes = progressNotes; }

    public String getStudentAccountId() { return studentAccountId; }
    public void setStudentAccountId(String studentAccountId) { this.studentAccountId = studentAccountId; }
}
