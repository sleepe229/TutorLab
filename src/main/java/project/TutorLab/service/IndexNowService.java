package project.TutorLab.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Notifies Bing and Yandex via the IndexNow protocol when tutor profiles
 * become publicly visible on the marketplace.
 *
 * Key verification file must be served at: https://{host}/{key}.txt
 * with the file content equal to the key string.
 */
@Service
public class IndexNowService {

    private static final Logger log = LoggerFactory.getLogger(IndexNowService.class);

    private static final String INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

    @Value("${app.indexnow.host:tutorlab.onrender.com}")
    private String host;

    @Value("${app.indexnow.key:b9d3f1a8e5c2d7f0}")
    private String key;

    @Value("${app.indexnow.enabled:true}")
    private boolean enabled;

    private final RestClient restClient = RestClient.create();

    /**
     * Submits a list of URLs to IndexNow asynchronously so it never blocks
     * the main request thread.
     */
    @Async
    public void submitUrls(List<String> urls) {
        if (!enabled || urls == null || urls.isEmpty()) return;
        try {
            Map<String, Object> body = Map.of(
                    "host", host,
                    "key", key,
                    "keyLocation", "https://" + host + "/" + key + ".txt",
                    "urlList", urls
            );
            restClient.post()
                    .uri(INDEXNOW_ENDPOINT)
                    .header("Content-Type", "application/json; charset=utf-8")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("IndexNow submitted {} URL(s)", urls.size());
        } catch (Exception e) {
            log.warn("IndexNow submission failed: {}", e.getMessage());
        }
    }

    public void submitUrl(String url) {
        submitUrls(List.of(url));
    }
}