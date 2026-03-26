package project.TutorLab.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import project.TutorLab.config.ClaudeConfig;
import project.TutorLab.model.LessonRecap;
import project.TutorLab.model.SessionSnapshot;
import project.TutorLab.model.live.LiveSessionState;
import project.TutorLab.repository.LessonRecapRepository;
import project.TutorLab.service.RecapService;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Generates lesson recaps asynchronously via the Claude API.
 *
 * Retry strategy (Governance: Recap Retry Strategy):
 *   Attempt 1: immediate
 *   Attempt 2: after 1s backoff
 *   Attempt 3: after 4s backoff
 *   On permanent failure: saves LessonRecap with generationFailed=true.
 *   Partial failure never blocks lesson completion.
 *
 * Note: recap is stored at lesson_recap:{snapshotId} — no modification to SessionSnapshot.
 */
@Service
public class RecapServiceImpl implements RecapService {

    private static final Logger log = LoggerFactory.getLogger(RecapServiceImpl.class);
    private static final int MAX_ATTEMPTS = 3;
    private static final long[] BACKOFF_MS = {0, 1_000, 4_000};

    private final ClaudeConfig claudeConfig;
    private final LessonRecapRepository recapRepository;
    private final ObjectMapper objectMapper;

    public RecapServiceImpl(ClaudeConfig claudeConfig, LessonRecapRepository recapRepository,
                            ObjectMapper objectMapper) {
        this.claudeConfig = claudeConfig;
        this.recapRepository = recapRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Async("recapTaskExecutor")
    public CompletableFuture<LessonRecap> generateRecapAsync(SessionSnapshot snapshot) {
        LessonRecap recap = new LessonRecap();
        recap.setSnapshotId(snapshot.getId());
        recap.setGeneratedAt(LocalDateTime.now());

        if (!claudeConfig.isEnabled()) {
            log.warn("Claude API not configured (app.claude.api-key is empty). Saving empty recap for snapshot {}",
                    snapshot.getId());
            recap.setGenerationFailed(false); // not a failure, just disabled
            recap.setAttemptCount(0);
            recapRepository.save(recap);
            return CompletableFuture.completedFuture(recap);
        }

        String prompt = buildPrompt(snapshot);
        LessonRecap result = attemptWithRetry(snapshot.getId(), prompt);
        recapRepository.save(result);
        return CompletableFuture.completedFuture(result);
    }

    private LessonRecap attemptWithRetry(String snapshotId, String prompt) {
        LessonRecap recap = new LessonRecap();
        recap.setSnapshotId(snapshotId);
        recap.setGeneratedAt(LocalDateTime.now());

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            recap.setAttemptCount(attempt);
            if (attempt > 1) {
                long sleepMs = BACKOFF_MS[attempt - 1];
                log.info("Recap retry attempt {} for snapshot {} after {}ms backoff", attempt, snapshotId, sleepMs);
                try {
                    Thread.sleep(sleepMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }

            try {
                String rawJson = callClaudeApi(prompt);
                recap.setRawResponse(rawJson);
                parseRecapJson(rawJson, recap);
                recap.setGenerationFailed(false);
                log.info("Recap generated successfully for snapshot {} on attempt {}", snapshotId, attempt);
                return recap;
            } catch (Exception e) {
                log.warn("Recap generation attempt {}/{} failed for snapshot {}: {}",
                        attempt, MAX_ATTEMPTS, snapshotId, e.getMessage());
                if (attempt == MAX_ATTEMPTS) {
                    recap.setGenerationFailed(true);
                    recap.setHomeworkAssigned("[Не удалось сгенерировать конспект автоматически]");
                }
            }
        }
        return recap;
    }

    private String buildPrompt(SessionSnapshot snapshot) {
        // Per-slide drawing density as a proxy for lesson complexity
        Map<Integer, List<LiveSessionState.DrawPath>> drawings = snapshot.getSlideDrawings();
        StringBuilder densityInfo = new StringBuilder("[");
        if (drawings != null) {
            for (int i = 0; i < (snapshot.getSlideUrls() != null ? snapshot.getSlideUrls().size() : 0); i++) {
                List<LiveSessionState.DrawPath> paths = drawings.getOrDefault(i, List.of());
                densityInfo.append(paths.size());
                if (i < snapshot.getSlideUrls().size() - 1) densityInfo.append(",");
            }
        }
        densityInfo.append("]");

        int slideCount = snapshot.getSlideUrls() != null ? snapshot.getSlideUrls().size() : 0;

        return String.format("""
            You are an assistant helping a tutor remember what happened in a lesson. Respond ONLY with valid JSON.

            Lesson: "%s"
            Duration: %d minutes
            Slides used: %d
            Drawing strokes per slide: %s

            Generate a structured lesson recap. Return as JSON only, no markdown, no explanation:
            { "topicsCovered": ["..."], "struggledWith": ["..."], "homeworkAssigned": "...", "nextSessionFocus": "..." }

            Rules:
            - topicsCovered: infer from slide count (1-3 topics per 5 slides)
            - struggledWith: slides with the most drawing activity suggest difficulty
            - homeworkAssigned: leave empty string "" if unclear
            - nextSessionFocus: one concise sentence
            - Respond in Russian
            """,
                snapshot.getTitle() != null ? snapshot.getTitle() : "Урок",
                snapshot.getDurationMinutes(),
                slideCount,
                densityInfo
        );
    }

    private String callClaudeApi(String userPrompt) throws Exception {
        String requestBody = objectMapper.writeValueAsString(Map.of(
                "model", claudeConfig.getModel(),
                "max_tokens", 512,
                "messages", List.of(Map.of("role", "user", "content", userPrompt))
        ));

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(claudeConfig.getTimeoutSeconds()))
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.anthropic.com/v1/messages"))
                .header("Content-Type", "application/json")
                .header("x-api-key", claudeConfig.getApiKey())
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofSeconds(claudeConfig.getTimeoutSeconds()))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("Claude API returned HTTP " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        return root.path("content").get(0).path("text").asText();
    }

    private void parseRecapJson(String rawText, LessonRecap recap) {
        try {
            // Strip markdown code fences if present
            String json = rawText.trim();
            if (json.startsWith("```")) {
                int start = json.indexOf('\n') + 1;
                int end = json.lastIndexOf("```");
                json = json.substring(start, end > start ? end : json.length()).trim();
            }
            JsonNode node = objectMapper.readTree(json);
            List<String> topics = new ArrayList<>();
            node.path("topicsCovered").forEach(n -> topics.add(n.asText()));
            List<String> struggled = new ArrayList<>();
            node.path("struggledWith").forEach(n -> struggled.add(n.asText()));
            recap.setTopicsCovered(topics);
            recap.setStruggledWith(struggled);
            recap.setHomeworkAssigned(node.path("homeworkAssigned").asText(""));
            recap.setNextSessionFocus(node.path("nextSessionFocus").asText(""));
        } catch (Exception e) {
            log.warn("Failed to parse Claude JSON response, storing raw text: {}", e.getMessage());
            recap.setTopicsCovered(new ArrayList<>());
            recap.setStruggledWith(new ArrayList<>());
            recap.setHomeworkAssigned(rawText); // store raw for manual review
            recap.setNextSessionFocus("");
        }
    }
}
