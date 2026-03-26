package project.TutorLab.repository.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.SessionSnapshot;
import project.TutorLab.repository.SessionSnapshotRepository;
import project.TutorLab.repository.jpa.SessionSnapshotJpaRepository;

import java.util.List;

@Repository
public class SessionSnapshotRepositoryImpl implements SessionSnapshotRepository {

    @Autowired
    private SessionSnapshotJpaRepository sessionSnapshotJpaRepository;

    @Override
    public void save(SessionSnapshot snapshot) {
        sessionSnapshotJpaRepository.save(snapshot);
    }

    @Override
    public SessionSnapshot findById(String snapshotId) {
        return sessionSnapshotJpaRepository.findById(snapshotId).orElse(null);
    }

    @Override
    public String findSnapshotIdBySessionId(String sessionId) {
        return sessionSnapshotJpaRepository.findBySessionId(sessionId)
                .map(SessionSnapshot::getId)
                .orElse(null);
    }

    @Override
    public List<SessionSnapshot> findByStudentId(String studentId) {
        return sessionSnapshotJpaRepository.findByStudentId(studentId);
    }

    @Override
    public List<SessionSnapshot> findByTutorId(String tutorId) {
        return sessionSnapshotJpaRepository.findByTutorId(tutorId);
    }
}
