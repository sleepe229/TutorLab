package project.TutorLab.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

@Entity
@Table(name = "chat_messages")
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatMessage {

    @Id
    private String id;

    @Column(name = "chat_id")
    private String chatId;

    @Column(name = "sender_id")
    private String senderId;

    @Column(name = "sender_role")
    private String senderRole;

    @Column(name = "sender_name")
    private String senderName;

    private String text;

    private String type;

    @Column(name = "invite_student_id")
    private String inviteStudentId;

    @Column(name = "file_url")
    private String fileUrl;

    @Column(name = "file_name")
    private String fileName;

    private long timestamp;

    @Column(name = "edited_at")
    private Long editedAt;

    @Column(nullable = false)
    private boolean deleted;

    public ChatMessage() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getChatId() { return chatId; }
    public void setChatId(String chatId) { this.chatId = chatId; }

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getSenderRole() { return senderRole; }
    public void setSenderRole(String senderRole) { this.senderRole = senderRole; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getInviteStudentId() { return inviteStudentId; }
    public void setInviteStudentId(String inviteStudentId) { this.inviteStudentId = inviteStudentId; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public Long getEditedAt() { return editedAt; }
    public void setEditedAt(Long editedAt) { this.editedAt = editedAt; }

    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
}
