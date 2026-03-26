package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "chats")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Chat {

    @Id
    private String id;

    private String type;

    @Column(name = "tutor_id")
    private String tutorId;

    @Column(name = "tutor_name")
    private String tutorName;

    @Column(name = "student_account_id")
    private String studentAccountId;

    @Column(name = "student_name")
    private String studentName;

    @Column(name = "last_message")
    private String lastMessage;

    @Column(name = "last_timestamp")
    private long lastTimestamp;

    @Column(name = "unread_count_tutor", nullable = false)
    private int unreadCountTutor;

    @Column(name = "unread_count_student", nullable = false)
    private int unreadCountStudent;

    @Column(name = "group_name")
    private String groupName;

    @Column(name = "group_avatar_url")
    private String groupAvatarUrl;

    @Column(name = "creator_id")
    private String creatorId;

    @Column(name = "creator_role")
    private String creatorRole;

    @Column(name = "blocked_by_tutor", nullable = false)
    private boolean blockedByTutor;

    @Column(name = "blocked_by_student", nullable = false)
    private boolean blockedByStudent;

    @Column(name = "hidden_for_tutor", nullable = false)
    private boolean hiddenForTutor;

    @Column(name = "hidden_for_student", nullable = false)
    private boolean hiddenForStudent;

    // Transient: populated from chat_participants table by ChatRepositoryImpl
    @Transient
    private List<String> participantIds;
    @Transient
    private List<String> adminIds;
    @Transient
    private List<String> hiddenForMembers;

    public Chat() {}

    public Chat(String id, String tutorId, String tutorName, String studentAccountId, String studentName) {
        this.id = id;
        this.tutorId = tutorId;
        this.tutorName = tutorName;
        this.studentAccountId = studentAccountId;
        this.studentName = studentName;
        this.lastTimestamp = System.currentTimeMillis();
        this.type = "DIRECT";
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

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }

    public String getGroupAvatarUrl() { return groupAvatarUrl; }
    public void setGroupAvatarUrl(String groupAvatarUrl) { this.groupAvatarUrl = groupAvatarUrl; }

    public String getCreatorId() { return creatorId; }
    public void setCreatorId(String creatorId) { this.creatorId = creatorId; }

    public String getCreatorRole() { return creatorRole; }
    public void setCreatorRole(String creatorRole) { this.creatorRole = creatorRole; }

    public List<String> getParticipantIds() {
        if (participantIds == null) participantIds = new ArrayList<>();
        return participantIds;
    }
    public void setParticipantIds(List<String> participantIds) { this.participantIds = participantIds; }

    public List<String> getAdminIds() {
        if (adminIds == null) adminIds = new ArrayList<>();
        return adminIds;
    }
    public void setAdminIds(List<String> adminIds) { this.adminIds = adminIds; }

    public List<String> getHiddenForMembers() {
        if (hiddenForMembers == null) hiddenForMembers = new ArrayList<>();
        return hiddenForMembers;
    }
    public void setHiddenForMembers(List<String> hiddenForMembers) { this.hiddenForMembers = hiddenForMembers; }

    public boolean isBlockedByTutor() { return blockedByTutor; }
    public void setBlockedByTutor(boolean blockedByTutor) { this.blockedByTutor = blockedByTutor; }

    public boolean isBlockedByStudent() { return blockedByStudent; }
    public void setBlockedByStudent(boolean blockedByStudent) { this.blockedByStudent = blockedByStudent; }

    public boolean isHiddenForTutor() { return hiddenForTutor; }
    public void setHiddenForTutor(boolean hiddenForTutor) { this.hiddenForTutor = hiddenForTutor; }

    public boolean isHiddenForStudent() { return hiddenForStudent; }
    public void setHiddenForStudent(boolean hiddenForStudent) { this.hiddenForStudent = hiddenForStudent; }

    public boolean isGroup() { return "GROUP".equals(type); }
    public boolean isBlocked() { return blockedByTutor || blockedByStudent; }
}
