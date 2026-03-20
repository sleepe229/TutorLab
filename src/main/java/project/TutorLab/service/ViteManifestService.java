package project.TutorLab.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/**
 * Reads the Vite build manifest (dist/.vite/manifest.json) at startup
 * so that SSR controllers can inject the correct hashed asset paths.
 */
@Service
public class ViteManifestService {

    private static final Logger log = LoggerFactory.getLogger(ViteManifestService.class);

    private String mainJsPath = "/src/main.jsx"; // dev fallback
    private String mainCssPath = null;

    @PostConstruct
    public void loadManifest() {
        try {
            ClassPathResource resource = new ClassPathResource("static/.vite/manifest.json");
            if (!resource.exists()) {
                log.info("Vite manifest not found (dev mode) — using fallback asset paths");
                return;
            }
            ObjectMapper mapper = new ObjectMapper();
            JsonNode manifest = mapper.readTree(resource.getInputStream());
            JsonNode entry = manifest.get("src/main.jsx");
            if (entry != null) {
                mainJsPath = "/" + entry.get("file").asText();
                JsonNode css = entry.get("css");
                if (css != null && css.isArray() && !css.isEmpty()) {
                    mainCssPath = "/" + css.get(0).asText();
                }
                log.info("Vite manifest loaded — JS: {}, CSS: {}", mainJsPath, mainCssPath);
            }
        } catch (Exception e) {
            log.warn("Failed to load Vite manifest: {}", e.getMessage());
        }
    }

    public String getMainJsPath() {
        return mainJsPath;
    }

    public String getMainCssPath() {
        return mainCssPath;
    }
}