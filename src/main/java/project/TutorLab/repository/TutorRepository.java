package project.TutorLab.repository;

import project.TutorLab.model.Tutor;

public interface TutorRepository {
    Tutor save(Tutor tutor);
    Tutor findById(String id);
    Tutor findByLogin(String login);
    Tutor findByGoogleId(String googleId);
    Tutor findByEmail(String email);
    void deleteById(String id);
    boolean existsById(String id);
    boolean existsByLogin(String login);
    java.util.List<Tutor> findAllPublic();
}

