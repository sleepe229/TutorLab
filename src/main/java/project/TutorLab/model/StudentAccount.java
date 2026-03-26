package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "student_accounts")
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentAccount {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "photo_url")
    private String photoUrl;

    @Column(name = "google_id", unique = true)
    private String googleId;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "student_account_links", joinColumns = @JoinColumn(name = "account_id"))
    @Column(name = "student_id")
    private List<String> linkedStudentIds = new ArrayList<>();

    public StudentAccount() {}

    public StudentAccount(String id, String email, String passwordHash,
                          String firstName, String lastName) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public List<String> getLinkedStudentIds() {
        return linkedStudentIds != null ? linkedStudentIds : new ArrayList<>();
    }
    public void setLinkedStudentIds(List<String> linkedStudentIds) { this.linkedStudentIds = linkedStudentIds; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }
}
