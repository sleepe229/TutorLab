package project.TutorLab.dto;

import java.util.List;
import java.util.Map;

public class StudentResponseDto {
    private String id;
    private String tutorId;
    private String tutorName;
    private String firstName;
    private String lastName;
    private Integer age;
    private String photoUrl;
    private List<String> interests;
    private List<String> materialUrls;
    private List<String> lessonDates;
    private Map<String, List<String>> lessonMaterials;
    private Integer pricePerLesson;
    private int trialLessonsCount;
    private Map<String, String> lessonPayments;

    public StudentResponseDto() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTutorId() {
        return tutorId;
    }

    public void setTutorId(String tutorId) {
        this.tutorId = tutorId;
    }

    public String getTutorName() {
        return tutorName;
    }

    public void setTutorName(String tutorName) {
        this.tutorName = tutorName;
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

    public List<String> getInterests() {
        return interests;
    }

    public void setInterests(List<String> interests) {
        this.interests = interests;
    }

    public List<String> getMaterialUrls() {
        return materialUrls;
    }

    public void setMaterialUrls(List<String> materialUrls) {
        this.materialUrls = materialUrls;
    }

    public List<String> getLessonDates() {
        return lessonDates;
    }

    public void setLessonDates(List<String> lessonDates) {
        this.lessonDates = lessonDates;
    }

    public Map<String, List<String>> getLessonMaterials() {
        return lessonMaterials;
    }

    public void setLessonMaterials(Map<String, List<String>> lessonMaterials) {
        this.lessonMaterials = lessonMaterials;
    }

    public Integer getPricePerLesson() {
        return pricePerLesson;
    }

    public void setPricePerLesson(Integer pricePerLesson) {
        this.pricePerLesson = pricePerLesson;
    }

    public int getTrialLessonsCount() {
        return trialLessonsCount;
    }

    public void setTrialLessonsCount(int trialLessonsCount) {
        this.trialLessonsCount = trialLessonsCount;
    }

    public Map<String, String> getLessonPayments() {
        return lessonPayments;
    }

    public void setLessonPayments(Map<String, String> lessonPayments) {
        this.lessonPayments = lessonPayments;
    }
}

