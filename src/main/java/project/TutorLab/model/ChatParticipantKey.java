package project.TutorLab.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class ChatParticipantKey implements Serializable {

    @Column(name = "chat_id")
    private String chatId;

    @Column(name = "participant_id")
    private String participantId;

    public ChatParticipantKey() {}

    public ChatParticipantKey(String chatId, String participantId) {
        this.chatId = chatId;
        this.participantId = participantId;
    }

    public String getChatId() { return chatId; }
    public void setChatId(String chatId) { this.chatId = chatId; }

    public String getParticipantId() { return participantId; }
    public void setParticipantId(String participantId) { this.participantId = participantId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ChatParticipantKey)) return false;
        ChatParticipantKey that = (ChatParticipantKey) o;
        return Objects.equals(chatId, that.chatId) && Objects.equals(participantId, that.participantId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(chatId, participantId);
    }
}
