package project.TutorLab.model.live;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class LiveSessionState implements Serializable {
    private String sessionId;
    private String tutorId;
    private String title;
    private int currentSlideIndex;
    private List<String> slideUrls = new ArrayList<>();
    private Map<Integer, List<DrawPath>> slideDrawings = new HashMap<>();

    // Getters & Setters
    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
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

    public Map<Integer, List<DrawPath>> getSlideDrawings() {
        return slideDrawings;
    }

    public void setSlideDrawings(Map<Integer, List<DrawPath>> slideDrawings) {
        this.slideDrawings = slideDrawings;
    }

    // Inner classes
    public static class DrawPath implements Serializable {
        private String pathId;
        private String color;
        private float width;
        private List<Point> points = new ArrayList<>();

        public String getPathId() {
            return pathId;
        }

        public void setPathId(String pathId) {
            this.pathId = pathId;
        }

        public String getColor() {
            return color;
        }

        public void setColor(String color) {
            this.color = color;
        }

        public float getWidth() {
            return width;
        }

        public void setWidth(float width) {
            this.width = width;
        }

        public List<Point> getPoints() {
            return points;
        }

        public void setPoints(List<Point> points) {
            this.points = points;
        }
    }

    public static class Point implements Serializable {
        private double x;
        private double y;

        public Point() {}
        public Point(double x, double y) {
            this.x = x;
            this.y = y;
        }

        public double getX() {
            return x;
        }

        public void setX(double x) {
            this.x = x;
        }

        public double getY() {
            return y;
        }

        public void setY(double y) {
            this.y = y;
        }
    }
}
