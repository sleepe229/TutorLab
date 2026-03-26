package project.TutorLab.model;

import jakarta.persistence.*;

@Entity
@Table(name = "chat_participants")
public class ChatParticipant {

    @EmbeddedId
    private ChatParticipantKey id;

    @Column(name = "is_admin", nullable = false)
    private boolean admin;

    @Column(name = "is_hidden", nullable = false)
    private boolean hidden;

    public ChatParticipant() {}

    public ChatParticipant(String chatId, String participantId, boolean admin, boolean hidden) {
        this.id = new ChatParticipantKey(chatId, participantId);
        this.admin = admin;
        this.hidden = hidden;
    }

    public ChatParticipantKey getId() { return id; }
    public void setId(ChatParticipantKey id) { this.id = id; }

    public String getChatId() { return id != null ? id.getChatId() : null; }
    public String getParticipantId() { return id != null ? id.getParticipantId() : null; }

    public boolean isAdmin() { return admin; }
    public void setAdmin(boolean admin) { this.admin = admin; }

    public boolean isHidden() { return hidden; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }
}
