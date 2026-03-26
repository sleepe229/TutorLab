package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tutors")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Tutor {

    @Id
    private String id;

    @Column(name = "full_name")
    private String fullName;

    @Column(unique = true)
    private String login;

    private String password;

    @Column(name = "photo_url")
    private String photoUrl;

    private String about;

    @Column(name = "hourly_rate")
    private Integer hourlyRate;

    @Column(name = "is_public_profile", nullable = false)
    private boolean isPublicProfile;

    @Column(name = "google_id", unique = true)
    private String googleId;

    @Column(unique = true)
    private String email;

    /** Not persisted — derived from students table. Kept for backward-compat with response DTOs. */
    @Transient
    private List<String> studentIds;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "tutor_subjects", joinColumns = @JoinColumn(name = "tutor_id"))
    @Column(name = "subject")
    private List<String> subjects = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "tutor_favorite_students", joinColumns = @JoinColumn(name = "tutor_id"))
    @Column(name = "student_id")
    private List<String> favoriteStudentIds = new ArrayList<>();

    public Tutor() {}

    public Tutor(String id, String fullName, String login, String password) {
        this.id = id;
        this.fullName = fullName;
        this.login = login;
        this.password = password;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getLogin() { return login; }
    public void setLogin(String login) { this.login = login; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public List<String> getStudentIds() { return studentIds; }
    public void setStudentIds(List<String> studentIds) { this.studentIds = studentIds; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getAbout() { return about; }
    public void setAbout(String about) { this.about = about; }

    public List<String> getFavoriteStudentIds() {
        if (favoriteStudentIds == null) favoriteStudentIds = new ArrayList<>();
        return favoriteStudentIds;
    }
    public void setFavoriteStudentIds(List<String> favoriteStudentIds) { this.favoriteStudentIds = favoriteStudentIds; }

    public List<String> getSubjects() {
        if (subjects == null) subjects = new ArrayList<>();
        return subjects;
    }
    public void setSubjects(List<String> subjects) { this.subjects = subjects; }

    public Integer getHourlyRate() { return hourlyRate; }
    public void setHourlyRate(Integer hourlyRate) { this.hourlyRate = hourlyRate; }

    @JsonProperty("isPublicProfile")
    public boolean isPublicProfile() { return isPublicProfile; }

    @JsonAlias("publicProfile")
    public void setPublicProfile(boolean publicProfile) { isPublicProfile = publicProfile; }

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
