package project.TutorLab.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class TutorUpdateDto {
    private String fullName;
    private String photoUrl;
    private String about;
    private java.util.List<String> subjects;
    private Integer hourlyRate;
    @JsonProperty("isPublicProfile")
    private Boolean isPublicProfile;

    public TutorUpdateDto() {
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
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

    public java.util.List<String> getSubjects() {
        return subjects;
    }

    public void setSubjects(java.util.List<String> subjects) {
        this.subjects = subjects;
    }

    public Integer getHourlyRate() {
        return hourlyRate;
    }

    public void setHourlyRate(Integer hourlyRate) {
        this.hourlyRate = hourlyRate;
    }

    public Boolean getIsPublicProfile() {
        return isPublicProfile;
    }

    public void setIsPublicProfile(Boolean isPublicProfile) {
        this.isPublicProfile = isPublicProfile;
    }
}

