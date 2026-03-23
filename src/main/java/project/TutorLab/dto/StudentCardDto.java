package project.TutorLab.dto;

import java.util.List;

public class StudentCardDto {
    private String id;
    private String firstName;
    private String lastName;
    private Integer age;
    private String photoUrl;
    private Boolean isFavorite;
    private List<String> lessonDates;
    private String studentAccountId;

    public StudentCardDto() {
    }

    public StudentCardDto(String id, String firstName, String lastName, Integer age, String photoUrl) {
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.age = age;
        this.photoUrl = photoUrl;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public Integer getAge() {
        return age;
    }

    public void setAge(Integer age) {
        this.age = age;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public Boolean getIsFavorite() {
        return isFavorite;
    }

    public void setIsFavorite(Boolean isFavorite) {
        this.isFavorite = isFavorite;
    }

    public List<String> getLessonDates() {
        return lessonDates;
    }

    public void setLessonDates(List<String> lessonDates) {
        this.lessonDates = lessonDates;
    }

    public String getStudentAccountId() { return studentAccountId; }
    public void setStudentAccountId(String studentAccountId) { this.studentAccountId = studentAccountId; }
}

