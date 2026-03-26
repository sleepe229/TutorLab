package project.TutorLab.repository.jpa;

import org.springframework.data.jpa.repository.JpaRepository;
import project.TutorLab.model.LessonRecap;

public interface LessonRecapJpaRepository extends JpaRepository<LessonRecap, String> {
    // findById(snapshotId) inherited from JpaRepository
}
