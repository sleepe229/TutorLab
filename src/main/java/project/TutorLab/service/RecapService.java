package project.TutorLab.service;

import project.TutorLab.model.LessonRecap;
import project.TutorLab.model.SessionSnapshot;

import java.util.concurrent.CompletableFuture;

public interface RecapService {
    /**
     * Asynchronously generates a lesson recap for the given snapshot.
     * Returns immediately. The LessonRecap is persisted to Redis when generation completes.
     * Retries up to 3 times with exponential backoff on failure.
     * Never throws — on permanent failure, saves LessonRecap with generationFailed=true.
     */
    CompletableFuture<LessonRecap> generateRecapAsync(SessionSnapshot snapshot);
}
