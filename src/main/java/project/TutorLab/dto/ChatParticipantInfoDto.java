package project.TutorLab.dto;

public class ChatParticipantInfoDto {
    private String id;
    private String name;
    private String avatarUrl;
    private boolean admin;

    public ChatParticipantInfoDto(String id, String name, String avatarUrl, boolean admin) {
        this.id = id;
        this.name = name;
        this.avatarUrl = avatarUrl;
        this.admin = admin;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getAvatarUrl() { return avatarUrl; }
    public boolean isAdmin() { return admin; }
}
