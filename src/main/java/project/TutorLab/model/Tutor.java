package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class Tutor {
    private String id;
    private String fullName;
    private String login;
    private String password;
    private String photoUrl;
    private String about;
    private List<String> studentIds;
    private List<String> favoriteStudentIds;
    private List<String> subjects;
    private Integer hourlyRate;
    private boolean isPublicProfile;

    public Tutor() {
    }

    public Tutor(String id, String fullName, String login, String password) {
        this.id = id;
        this.fullName = fullName;
        this.login = login;
        this.password = password;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getLogin() {
        return login;
    }

    public void setLogin(String login) {
        this.login = login;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public List<String> getStudentIds() {
        return studentIds;
    }

    public void setStudentIds(List<String> studentIds) {
        this.studentIds = studentIds;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getAbout() {
        return about;
    }

    public void setAbout(String about) {
        this.about = about;
    }

    public List<String> getFavoriteStudentIds() {
        return favoriteStudentIds;
    }

    public void setFavoriteStudentIds(List<String> favoriteStudentIds) {
        this.favoriteStudentIds = favoriteStudentIds;
    }

    public List<String> getSubjects() {
        return subjects;
    }

    public void setSubjects(List<String> subjects) {
        this.subjects = subjects;
    }

    public Integer getHourlyRate() {
        return hourlyRate;
    }

    public void setHourlyRate(Integer hourlyRate) {
        this.hourlyRate = hourlyRate;
    }

    @JsonProperty("isPublicProfile")
    public boolean isPublicProfile() {
        return isPublicProfile;
    }

    public void setPublicProfile(boolean publicProfile) {
        isPublicProfile = publicProfile;
    }
}
