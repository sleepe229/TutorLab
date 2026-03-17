package project.TutorLab.model;

public class ChatMessage {
    private String id;
    private String chatId;
    private String senderId;
    private String senderRole;
    private String senderName;
    private String text;
    private String type;
    private String inviteStudentId;
    private long timestamp;

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

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
