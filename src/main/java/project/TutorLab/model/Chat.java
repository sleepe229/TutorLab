package project.TutorLab.model;

public class Chat {
    private String id;
    private String tutorId;
    private String tutorName;
    private String studentAccountId;
    private String studentName;
    private String lastMessage;
    private long lastTimestamp;
    private int unreadCountTutor;
    private int unreadCountStudent;

    public Chat() {}

    public Chat(String id, String tutorId, String tutorName, String studentAccountId, String studentName) {
        this.id = id;
        this.tutorId = tutorId;
        this.tutorName = tutorName;
        this.studentAccountId = studentAccountId;
        this.studentName = studentName;
        this.lastTimestamp = System.currentTimeMillis();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTutorId() { return tutorId; }
    public void setTutorId(String tutorId) { this.tutorId = tutorId; }

    public String getTutorName() { return tutorName; }
    public void setTutorName(String tutorName) { this.tutorName = tutorName; }

    public String getStudentAccountId() { return studentAccountId; }
    public void setStudentAccountId(String studentAccountId) { this.studentAccountId = studentAccountId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }

    public long getLastTimestamp() { return lastTimestamp; }
    public void setLastTimestamp(long lastTimestamp) { this.lastTimestamp = lastTimestamp; }

    public int getUnreadCountTutor() { return unreadCountTutor; }
    public void setUnreadCountTutor(int unreadCountTutor) { this.unreadCountTutor = unreadCountTutor; }

    public int getUnreadCountStudent() { return unreadCountStudent; }
    public void setUnreadCountStudent(int unreadCountStudent) { this.unreadCountStudent = unreadCountStudent; }
}
