package project.TutorLab.repository.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.Tutor;
import project.TutorLab.repository.TutorRepository;
import project.TutorLab.repository.jpa.TutorJpaRepository;

import java.util.List;

@Repository
public class TutorRepositoryImpl implements TutorRepository {

    @Autowired
    private TutorJpaRepository tutorJpaRepository;

    @Override
    public Tutor save(Tutor tutor) {
        return tutorJpaRepository.save(tutor);
    }

    @Override
    public Tutor findById(String id) {
        return tutorJpaRepository.findById(id).orElse(null);
    }

    @Override
    public void deleteById(String id) {
        tutorJpaRepository.deleteById(id);
    }

    @Override
    public boolean existsById(String id) {
        return tutorJpaRepository.existsById(id);
    }

    @Override
    public Tutor findByLogin(String login) {
        return tutorJpaRepository.findByLogin(login).orElse(null);
    }

    @Override
    public boolean existsByLogin(String login) {
        return tutorJpaRepository.existsByLogin(login);
    }

    @Override
    public Tutor findByGoogleId(String googleId) {
        return tutorJpaRepository.findByGoogleId(googleId).orElse(null);
    }

    @Override
    public Tutor findByEmail(String email) {
        return tutorJpaRepository.findByEmail(email).orElse(null);
    }

    @Override
    public List<Tutor> findAllPublic() {
        return tutorJpaRepository.findAllPublicTutors();
    }
}
