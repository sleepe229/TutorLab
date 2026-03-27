package project.TutorLab.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.server.ResponseStatusException;
import project.TutorLab.dto.ChatParticipantInfoDto;
import project.TutorLab.model.Chat;
import project.TutorLab.model.ChatMessage;
import project.TutorLab.model.StudentAccount;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.ChatRepository;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.repository.jpa.StudentAccountJpaRepository;
import project.TutorLab.service.impl.ChatServiceImpl;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatServiceImplTest {

    @Mock private ChatRepository chatRepository;
    @Mock private TutorRepository tutorRepository;
    @Mock private StudentAccountJpaRepository studentAccountJpaRepository;
    @Mock private MessageEncryptionService encryptionService;

    @InjectMocks
    private ChatServiceImpl chatService;

    private Chat directChat;
    private Chat groupChat;

    @BeforeEach
    void setUp() {
        // Encryption passthrough by default
        when(encryptionService.encrypt(anyString())).thenAnswer(i -> i.getArgument(0));
        when(encryptionService.decrypt(anyString())).thenAnswer(i -> i.getArgument(0));
        when(encryptionService.encrypt(null)).thenReturn(null);
        when(encryptionService.decrypt(null)).thenReturn(null);

        directChat = new Chat();
        directChat.setId("chat-1");
        directChat.setType("DIRECT");
        directChat.setTutorId("tutor-1");
        directChat.setStudentAccountId("student-1");
        directChat.setStudentName("Иван Иванов");
        directChat.setTutorName("Репетитор");

        groupChat = new Chat();
        groupChat.setId("group-1");
        groupChat.setType("GROUP");
        groupChat.setGroupName("Группа тест");
        groupChat.setCreatorId("tutor-1");
        groupChat.setCreatorRole("TUTOR");
        List<String> participants = new ArrayList<>(List.of("tutor-1", "student-1", "student-2"));
        groupChat.setParticipantIds(participants);
        List<String> admins = new ArrayList<>(List.of("tutor-1"));
        groupChat.setAdminIds(admins);
        groupChat.setHiddenForMembers(new ArrayList<>());
    }

    // ── getChat ──────────────────────────────────────────────────────────────

    @Test
    void getChat_existingId_returnsChat() {
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        assertEquals(directChat, chatService.getChat("chat-1"));
    }

    @Test
    void getChat_unknownId_returnsNull() {
        when(chatRepository.findById("unknown")).thenReturn(null);
        assertNull(chatService.getChat("unknown"));
    }

    // ── getParticipantInfo ────────────────────────────────────────────────────

    @Test
    void getParticipantInfo_unknownChat_returnsEmptyList() {
        when(chatRepository.findById("x")).thenReturn(null);
        assertTrue(chatService.getParticipantInfo("x").isEmpty());
    }

    @Test
    void getParticipantInfo_directChat_resolvesTutorAndStudent() {
        when(chatRepository.findById("chat-1")).thenReturn(directChat);

        Tutor tutor = new Tutor();
        tutor.setId("tutor-1");
        tutor.setFullName("Алексей Смирнов");
        tutor.setPhotoUrl("/api/photo/tutor.jpg");
        when(tutorRepository.findById("tutor-1")).thenReturn(tutor);

        StudentAccount sa = new StudentAccount("student-1", "ivan@test.ru", null, "Иван", "Иванов");
        when(studentAccountJpaRepository.findById("student-1")).thenReturn(Optional.of(sa));

        List<ChatParticipantInfoDto> result = chatService.getParticipantInfo("chat-1");

        assertEquals(2, result.size());
        ChatParticipantInfoDto tutorInfo = result.stream()
                .filter(p -> "tutor-1".equals(p.getId())).findFirst().orElseThrow();
        assertEquals("Алексей Смирнов", tutorInfo.getName());

        ChatParticipantInfoDto studentInfo = result.stream()
                .filter(p -> "student-1".equals(p.getId())).findFirst().orElseThrow();
        assertEquals("Иван Иванов", studentInfo.getName());
    }

    @Test
    void getParticipantInfo_unknownParticipant_usesIdAsName() {
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        when(tutorRepository.findById(anyString())).thenReturn(null);
        when(studentAccountJpaRepository.findById(anyString())).thenReturn(Optional.empty());

        List<ChatParticipantInfoDto> result = chatService.getParticipantInfo("chat-1");

        assertEquals(2, result.size());
        result.forEach(p -> assertEquals(p.getId(), p.getName()));
    }

    // ── getOrCreateChat ───────────────────────────────────────────────────────

    @Test
    void getOrCreateChat_existingChat_returnsExisting() {
        when(chatRepository.findByTutorAndStudent("tutor-1", "student-1")).thenReturn(directChat);
        Chat result = chatService.getOrCreateChat("tutor-1", "student-1", "Иван", "Репетитор");
        assertEquals(directChat, result);
        verify(chatRepository, never()).save(any());
    }

    @Test
    void getOrCreateChat_newChat_savesAndReturns() {
        when(chatRepository.findByTutorAndStudent("tutor-1", "student-1")).thenReturn(null);
        when(chatRepository.save(any(Chat.class))).thenAnswer(i -> i.getArgument(0));

        Chat result = chatService.getOrCreateChat("tutor-1", "student-1", "Иван", "Репетитор");

        assertNotNull(result.getId());
        assertEquals("DIRECT", result.getType());
        assertEquals("tutor-1", result.getTutorId());
        verify(chatRepository).save(any(Chat.class));
    }

    // ── getChatsForTutor ──────────────────────────────────────────────────────

    @Test
    void getChatsForTutor_filtersHiddenDirectChats() {
        Chat hiddenChat = new Chat();
        hiddenChat.setType("DIRECT");
        hiddenChat.setHiddenForTutor(true);

        Chat visibleChat = new Chat();
        visibleChat.setType("DIRECT");
        visibleChat.setHiddenForTutor(false);

        when(chatRepository.findByTutorId("tutor-1"))
                .thenReturn(new ArrayList<>(List.of(hiddenChat, visibleChat)));

        List<Chat> result = chatService.getChatsForTutor("tutor-1");

        assertEquals(1, result.size());
        assertFalse(result.get(0).isHiddenForTutor());
    }

    // ── sendMessage ───────────────────────────────────────────────────────────

    @Test
    void sendMessage_normalText_savesEncryptedAndReturnsPlaintext() {
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        when(encryptionService.encrypt("Привет")).thenReturn("ENCRYPTED");
        when(encryptionService.decrypt("ENCRYPTED")).thenReturn("Привет");

        ChatMessage result = chatService.sendMessage(
                "chat-1", "tutor-1", "TUTOR", "Репетитор",
                "Привет", "TEXT", null, null, null);

        // Returned message has plaintext
        assertEquals("Привет", result.getText());
        verify(encryptionService).encrypt("Привет");
        verify(chatRepository).saveMessage(eq("chat-1"), any(ChatMessage.class));
    }

    @Test
    void sendMessage_toBlockedChat_throwsForbidden() {
        directChat.setBlockedByTutor(true);
        when(chatRepository.findById("chat-1")).thenReturn(directChat);

        assertThrows(ResponseStatusException.class, () ->
                chatService.sendMessage("chat-1", "tutor-1", "TUTOR", "Rep",
                        "text", "TEXT", null, null, null));
    }

    @Test
    void sendMessage_nonMemberToGroup_throwsForbidden() {
        when(chatRepository.findById("group-1")).thenReturn(groupChat);

        assertThrows(ResponseStatusException.class, () ->
                chatService.sendMessage("group-1", "outsider-99", "TUTOR", "Alien",
                        "hello", "TEXT", null, null, null));
    }

    @Test
    void sendMessage_incrementsUnreadCountForStudent_onTutorMessage() {
        directChat.setUnreadCountStudent(0);
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.sendMessage("chat-1", "tutor-1", "TUTOR", "Rep",
                "hi", "TEXT", null, null, null);

        assertEquals(1, directChat.getUnreadCountStudent());
    }

    @Test
    void sendMessage_incrementsUnreadCountForTutor_onStudentMessage() {
        directChat.setUnreadCountTutor(0);
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.sendMessage("chat-1", "student-1", "STUDENT", "Ivan",
                "hi", "TEXT", null, null, null);

        assertEquals(1, directChat.getUnreadCountTutor());
    }

    // ── getMessages ───────────────────────────────────────────────────────────

    @Test
    void getMessages_decryptsAllMessageTexts() {
        ChatMessage m1 = new ChatMessage();
        m1.setId("msg-1");
        m1.setText("ENCRYPTED_TEXT");
        m1.setFileName("ENCRYPTED_NAME");

        when(chatRepository.getMessages("chat-1")).thenReturn(List.of(m1));
        when(encryptionService.decrypt("ENCRYPTED_TEXT")).thenReturn("Plaintext");
        when(encryptionService.decrypt("ENCRYPTED_NAME")).thenReturn("file.pdf");

        List<ChatMessage> result = chatService.getMessages("chat-1");

        assertEquals(1, result.size());
        assertEquals("Plaintext", result.get(0).getText());
        assertEquals("file.pdf", result.get(0).getFileName());
    }

    // ── markReadByTutor / markReadByStudent ───────────────────────────────────

    @Test
    void markReadByTutor_resetsUnreadCountTutor() {
        directChat.setUnreadCountTutor(5);
        when(chatRepository.findById("chat-1")).thenReturn(directChat);

        chatService.markReadByTutor("chat-1");

        assertEquals(0, directChat.getUnreadCountTutor());
        verify(chatRepository).save(directChat);
    }

    @Test
    void markReadByStudent_resetsUnreadCountStudent() {
        directChat.setUnreadCountStudent(3);
        when(chatRepository.findById("chat-1")).thenReturn(directChat);

        chatService.markReadByStudent("chat-1");

        assertEquals(0, directChat.getUnreadCountStudent());
        verify(chatRepository).save(directChat);
    }

    // ── editMessage ───────────────────────────────────────────────────────────

    @Test
    void editMessage_ownMessage_withinWindow_updatesText() {
        ChatMessage msg = buildMessage("msg-1", "tutor-1", "Old text", false,
                System.currentTimeMillis() - 1000);

        when(chatRepository.getMessages("chat-1")).thenReturn(List.of(msg));
        when(encryptionService.encrypt("New text")).thenReturn("ENC_NEW");

        ChatMessage result = chatService.editMessage("chat-1", "msg-1", "New text", "tutor-1");

        assertEquals("New text", result.getText()); // returns plaintext
        verify(encryptionService).encrypt("New text");
        verify(chatRepository).updateMessage(eq("chat-1"), any(ChatMessage.class));
    }

    @Test
    void editMessage_notFound_throwsNotFound() {
        when(chatRepository.getMessages("chat-1")).thenReturn(List.of());

        assertThrows(ResponseStatusException.class, () ->
                chatService.editMessage("chat-1", "no-msg", "text", "tutor-1"));
    }

    @Test
    void editMessage_notOwner_throwsForbidden() {
        ChatMessage msg = buildMessage("msg-1", "tutor-1", "text", false,
                System.currentTimeMillis() - 1000);
        when(chatRepository.getMessages("chat-1")).thenReturn(List.of(msg));

        assertThrows(ResponseStatusException.class, () ->
                chatService.editMessage("chat-1", "msg-1", "edited", "student-1"));
    }

    @Test
    void editMessage_deletedMessage_throwsGone() {
        ChatMessage msg = buildMessage("msg-1", "tutor-1", "text", true,
                System.currentTimeMillis() - 1000);
        when(chatRepository.getMessages("chat-1")).thenReturn(List.of(msg));

        assertThrows(ResponseStatusException.class, () ->
                chatService.editMessage("chat-1", "msg-1", "edited", "tutor-1"));
    }

    @Test
    void editMessage_outsideWindow_throwsUnprocessable() {
        long oldTimestamp = System.currentTimeMillis() - (49L * 60 * 60 * 1000);
        ChatMessage msg = buildMessage("msg-1", "tutor-1", "text", false, oldTimestamp);
        when(chatRepository.getMessages("chat-1")).thenReturn(List.of(msg));

        assertThrows(ResponseStatusException.class, () ->
                chatService.editMessage("chat-1", "msg-1", "edited", "tutor-1"));
    }

    // ── deleteMessage ─────────────────────────────────────────────────────────

    @Test
    void deleteMessage_ownMessage_softDeletes() {
        ChatMessage msg = buildMessage("msg-1", "tutor-1", "text", false,
                System.currentTimeMillis());
        when(chatRepository.getMessages("chat-1")).thenReturn(List.of(msg));

        ChatMessage result = chatService.deleteMessage("chat-1", "msg-1", "tutor-1");

        assertTrue(result.isDeleted());
        assertEquals("", result.getText());
        verify(chatRepository).updateMessage(eq("chat-1"), any());
    }

    @Test
    void deleteMessage_notOwner_throwsForbidden() {
        ChatMessage msg = buildMessage("msg-1", "tutor-1", "text", false,
                System.currentTimeMillis());
        when(chatRepository.getMessages("chat-1")).thenReturn(List.of(msg));

        assertThrows(ResponseStatusException.class, () ->
                chatService.deleteMessage("chat-1", "msg-1", "student-1"));
    }

    // ── createGroup ───────────────────────────────────────────────────────────

    @Test
    void createGroup_createsGroupWithCreatorAsAdmin() {
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Chat group = chatService.createGroup("Группа",
                List.of("student-1", "student-2"),
                "tutor-1", "TUTOR", "Репетитор");

        assertEquals("GROUP", group.getType());
        assertTrue(group.getAdminIds().contains("tutor-1"));
        assertTrue(group.getParticipantIds().contains("tutor-1"));
        assertTrue(group.getParticipantIds().contains("student-1"));
        verify(chatRepository).saveMessage(eq(group.getId()), any());
    }

    @Test
    void createGroup_creatorNotInList_addsCreatorFirst() {
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Chat group = chatService.createGroup("G",
                List.of("student-1"), "tutor-1", "TUTOR", "Rep");

        assertEquals("tutor-1", group.getParticipantIds().get(0));
    }

    // ── addGroupMember ────────────────────────────────────────────────────────

    @Test
    void addGroupMember_byAdmin_addsMember() {
        when(chatRepository.findById("group-1")).thenReturn(groupChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.addGroupMember("group-1", "new-student-3", "tutor-1");

        assertTrue(groupChat.getParticipantIds().contains("new-student-3"));
        verify(chatRepository).addToGroupIndex("new-student-3", "group-1");
    }

    @Test
    void addGroupMember_byNonAdmin_throwsForbidden() {
        when(chatRepository.findById("group-1")).thenReturn(groupChat);

        assertThrows(ResponseStatusException.class, () ->
                chatService.addGroupMember("group-1", "new", "student-1"));
    }

    @Test
    void addGroupMember_alreadyMember_idempotent() {
        when(chatRepository.findById("group-1")).thenReturn(groupChat);

        chatService.addGroupMember("group-1", "student-1", "tutor-1");

        // participant list should not grow
        assertEquals(3, groupChat.getParticipantIds().size());
        verify(chatRepository, never()).addToGroupIndex(anyString(), anyString());
    }

    // ── removeGroupMember ─────────────────────────────────────────────────────

    @Test
    void removeGroupMember_selfLeave_removesMember() {
        when(chatRepository.findById("group-1")).thenReturn(groupChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.removeGroupMember("group-1", "student-1", "student-1");

        assertFalse(groupChat.getParticipantIds().contains("student-1"));
        verify(chatRepository).removeFromGroupIndex("student-1", "group-1");
    }

    @Test
    void removeGroupMember_adminRemovesOther_removesMember() {
        when(chatRepository.findById("group-1")).thenReturn(groupChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.removeGroupMember("group-1", "student-2", "tutor-1");

        assertFalse(groupChat.getParticipantIds().contains("student-2"));
    }

    @Test
    void removeGroupMember_nonAdminRemovesOther_throwsForbidden() {
        when(chatRepository.findById("group-1")).thenReturn(groupChat);

        assertThrows(ResponseStatusException.class, () ->
                chatService.removeGroupMember("group-1", "student-2", "student-1"));
    }

    @Test
    void removeGroupMember_lastAdmin_promotesNextMember() {
        // Remove the only admin
        when(chatRepository.findById("group-1")).thenReturn(groupChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.removeGroupMember("group-1", "tutor-1", "tutor-1");

        assertFalse(groupChat.getAdminIds().isEmpty());
        // Next remaining member should be promoted
        String promotedId = groupChat.getParticipantIds().get(0);
        assertTrue(groupChat.getAdminIds().contains(promotedId));
    }

    // ── blockChat / unblockChat ───────────────────────────────────────────────

    @Test
    void blockChat_byTutor_setsBlockedByTutor() {
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.blockChat("chat-1", "tutor-1", "TUTOR");

        assertTrue(directChat.isBlockedByTutor());
        assertFalse(directChat.isBlockedByStudent());
    }

    @Test
    void blockChat_byStudent_setsBlockedByStudent() {
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.blockChat("chat-1", "student-1", "STUDENT");

        assertTrue(directChat.isBlockedByStudent());
        assertFalse(directChat.isBlockedByTutor());
    }

    @Test
    void blockChat_unknownChat_throwsNotFound() {
        when(chatRepository.findById("no")).thenReturn(null);
        assertThrows(ResponseStatusException.class, () ->
                chatService.blockChat("no", "x", "TUTOR"));
    }

    @Test
    void unblockChat_byTutor_clearsBlockedByTutor() {
        directChat.setBlockedByTutor(true);
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.unblockChat("chat-1", "tutor-1", "TUTOR");

        assertFalse(directChat.isBlockedByTutor());
    }

    // ── hideChat / unhideChat ─────────────────────────────────────────────────

    @Test
    void hideChat_directChat_byTutor_setsHiddenForTutor() {
        when(chatRepository.findById("chat-1")).thenReturn(directChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.hideChat("chat-1", "tutor-1", "TUTOR");

        assertTrue(directChat.isHiddenForTutor());
    }

    @Test
    void hideChat_groupChat_addsToHiddenForMembers() {
        when(chatRepository.findById("group-1")).thenReturn(groupChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.hideChat("group-1", "student-1", "STUDENT");

        assertTrue(groupChat.getHiddenForMembers().contains("student-1"));
    }

    @Test
    void unhideChat_groupChat_removesFromHiddenForMembers() {
        groupChat.getHiddenForMembers().add("student-1");
        when(chatRepository.findById("group-1")).thenReturn(groupChat);
        when(chatRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        chatService.unhideChat("group-1", "student-1", "STUDENT");

        assertFalse(groupChat.getHiddenForMembers().contains("student-1"));
    }

    // ── getGroupsForParticipant ───────────────────────────────────────────────

    @Test
    void getGroupsForParticipant_filtersHiddenGroups() {
        Chat hidden = new Chat();
        hidden.setId("g-hidden");
        hidden.setType("GROUP");
        hidden.setHiddenForMembers(new ArrayList<>(List.of("student-1")));

        Chat visible = new Chat();
        visible.setId("g-visible");
        visible.setType("GROUP");
        visible.setHiddenForMembers(new ArrayList<>());

        when(chatRepository.findGroupsByParticipantId("student-1"))
                .thenReturn(new ArrayList<>(List.of(hidden, visible)));

        List<Chat> result = chatService.getGroupsForParticipant("student-1");

        assertEquals(1, result.size());
        assertEquals("g-visible", result.get(0).getId());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private ChatMessage buildMessage(String id, String senderId, String text,
                                     boolean deleted, long timestamp) {
        ChatMessage m = new ChatMessage();
        m.setId(id);
        m.setSenderId(senderId);
        m.setText(text);
        m.setDeleted(deleted);
        m.setTimestamp(timestamp);
        return m;
    }
}
