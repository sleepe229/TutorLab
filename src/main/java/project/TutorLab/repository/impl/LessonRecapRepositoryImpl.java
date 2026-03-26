package project.TutorLab.repository.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import project.TutorLab.model.LessonRecap;
import project.TutorLab.repository.LessonRecapRepository;
import project.TutorLab.repository.jpa.LessonRecapJpaRepository;

@Repository
public class LessonRecapRepositoryImpl implements LessonRecapRepository {

    @Autowired
    private LessonRecapJpaRepository lessonRecapJpaRepository;

    @Override
    public void save(LessonRecap recap) {
        lessonRecapJpaRepository.save(recap);
    }

    @Override
    public LessonRecap findBySnapshotId(String snapshotId) {
        return lessonRecapJpaRepository.findById(snapshotId).orElse(null);
    }
}
