package project.TutorLab.service;

import project.TutorLab.model.StudentAccount;

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
}
