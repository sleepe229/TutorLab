package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Chat {
    private String id;
    // DIRECT chat fields
    private String tutorId;
    private String tutorName;
    private String studentAccountId;
    private String studentName;
    // Common fields
    private String lastMessage;
    private long lastTimestamp;
    private int unreadCountTutor;
    private int unreadCountStudent;
    // Chat type: "DIRECT" (default) | "GROUP"
    private String type;
    // GROUP-only fields
    private String groupName;
    private String groupAvatarUrl;
    private String creatorId;
    private String creatorRole; // "TUTOR" | "STUDENT"
    private List<String> participantIds;    // all participant IDs
    private List<String> adminIds;          // admin participant IDs
    private List<String> hiddenForMembers;  // GROUP: participantIds that have hidden this chat
    // DIRECT-only moderation fields
    private boolean blockedByTutor;
    private boolean blockedByStudent;
    private boolean hiddenForTutor;
    private boolean hiddenForStudent;

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
