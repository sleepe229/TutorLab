package project.TutorLab.service;

import project.TutorLab.dto.StudentSessionHistoryDto;
import project.TutorLab.model.StudentAccount;

import java.util.List;
import java.util.Map;

public interface StudentAccountService {
    Map<String, Object> register(String email, String password,
                                  String firstName, String lastName,
                                  String linkedStudentId);

    Map<String, Object> login(String email, String password);

    Map<String, Object> refresh(String refreshToken);

    void logout(String refreshToken);

    StudentAccount getById(String id);

    void linkToStudent(String accountId, String studentId);

    /**
     * Returns session history for all student profiles linked to this account.
     * One DTO per linked student profile, ordered by most recent session descending.
     */
    List<StudentSessionHistoryDto> getStudentHistory(String accountId);

    /**
     * Updates name and/or password for the given account.
     * If newPassword is provided, currentPassword must be correct.
     */
    Map<String, Object> updateAccount(String accountId, String firstName, String lastName,
                                      String currentPassword, String newPassword);
}
