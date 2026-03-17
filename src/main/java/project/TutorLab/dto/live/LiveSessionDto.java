package project.TutorLab.dto.live;

import java.util.List;

public class LiveSessionDto {
    private String id;
    private String tutorId;
    private String title;
    private int currentSlideIndex;
    private List<String> slideUrls;

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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getCurrentSlideIndex() {
        return currentSlideIndex;
    }

    public void setCurrentSlideIndex(int currentSlideIndex) {
        this.currentSlideIndex = currentSlideIndex;
    }

    public List<String> getSlideUrls() {
        return slideUrls;
    }

    public void setSlideUrls(List<String> slideUrls) {
        this.slideUrls = slideUrls;
    }
}
