package project.TutorLab.dto;

import java.util.List;

public class StudentSessionHistoryDto {
    private String studentId;
    private String studentFirstName;
    private String studentLastName;
    private String tutorId;
    private String tutorName;
    private List<SnapshotSummaryDto> sessions;

    public StudentSessionHistoryDto() {}

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getStudentFirstName() { return studentFirstName; }
    public void setStudentFirstName(String studentFirstName) { this.studentFirstName = studentFirstName; }

    public String getStudentLastName() { return studentLastName; }
    public void setStudentLastName(String studentLastName) { this.studentLastName = studentLastName; }

    public String getTutorId() { return tutorId; }
    public void setTutorId(String tutorId) { this.tutorId = tutorId; }

    public String getTutorName() { return tutorName; }
    public void setTutorName(String tutorName) { this.tutorName = tutorName; }

    public List<SnapshotSummaryDto> getSessions() { return sessions; }
    public void setSessions(List<SnapshotSummaryDto> sessions) { this.sessions = sessions; }
}
