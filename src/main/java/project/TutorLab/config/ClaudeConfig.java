package project.TutorLab.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClaudeConfig {

    @Value("${app.claude.api-key:}")
    private String apiKey;

    @Value("${app.claude.model:claude-haiku-4-5-20251001}")
    private String model;

    @Value("${app.claude.enabled:true}")
    private boolean enabled;

    @Value("${app.claude.timeout-seconds:30}")
    private int timeoutSeconds;

    public String getApiKey() { return apiKey; }
    public String getModel() { return model; }
    public boolean isEnabled() { return enabled && apiKey != null && !apiKey.isBlank(); }
    public int getTimeoutSeconds() { return timeoutSeconds; }
}
