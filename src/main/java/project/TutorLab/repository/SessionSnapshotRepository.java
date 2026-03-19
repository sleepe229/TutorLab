package project.TutorLab.repository;

import project.TutorLab.model.SessionSnapshot;

import java.util.List;

public interface SessionSnapshotRepository {
    void save(SessionSnapshot snapshot);
    SessionSnapshot findById(String snapshotId);
    /** Dedup check: returns the snapshotId if a snapshot already exists for this sessionId, null otherwise. */
    String findSnapshotIdBySessionId(String sessionId);
    List<SessionSnapshot> findByStudentId(String studentId);
    List<SessionSnapshot> findByTutorId(String tutorId);
}
