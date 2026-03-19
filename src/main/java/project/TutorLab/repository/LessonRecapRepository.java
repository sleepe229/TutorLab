package project.TutorLab.repository;

import project.TutorLab.model.LessonRecap;

public interface LessonRecapRepository {
    /** Key: lesson_recap:{snapshotId} — snapshotId IS the recap lookup key. */
    void save(LessonRecap recap);
    LessonRecap findBySnapshotId(String snapshotId);
}
