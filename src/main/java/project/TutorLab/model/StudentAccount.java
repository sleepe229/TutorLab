package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentAccount {
    private String id;
    private String email;
    private String passwordHash;
    private String firstName;
    private String lastName;
    /** IDs of tutor-created Student records this account is linked to (one per tutor) */
    private java.util.List<String> linkedStudentIds = new java.util.ArrayList<>();
    private String photoUrl;
    private String googleId;   // Google OAuth sub (nullable)

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

    public java.util.List<String> getLinkedStudentIds() {
        return linkedStudentIds != null ? linkedStudentIds : new java.util.ArrayList<>();
    }
    public void setLinkedStudentIds(java.util.List<String> linkedStudentIds) {
        this.linkedStudentIds = linkedStudentIds;
    }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }
}
