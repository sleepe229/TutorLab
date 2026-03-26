package project.TutorLab.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/**
 * Converts Render's DATABASE_URL (postgres://user:pass@host:port/dbname)
 * into the jdbc:postgresql:// form that Spring Boot / Hikari expect.
 *
 * Only activates when:
 *  - DATABASE_URL env var is present, AND
 *  - spring.datasource.url is NOT already set (e.g. by SPRING_DATASOURCE_URL
 *    in docker-compose or local dev)
 *
 * Registered in META-INF/spring/org.springframework.boot.env.EnvironmentPostProcessor
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment,
                                       SpringApplication application) {

        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return;
        }

        // If SPRING_DATASOURCE_URL env var is explicitly set (e.g. docker-compose),
        // Spring Boot maps it to spring.datasource.url with higher priority than addFirst —
        // so we still proceed to set our source, but the explicit env var will override it.
        // Only skip if SPRING_DATASOURCE_URL contains a real resolved JDBC URL.
        String explicitSpringUrl = System.getenv("SPRING_DATASOURCE_URL");
        if (explicitSpringUrl != null && !explicitSpringUrl.isBlank()) {
            return;
        }

        try {
            // Render provides postgres:// or postgresql://
            String normalised = databaseUrl
                    .replace("postgres://", "postgresql://");
            URI uri = new URI(normalised);

            String jdbcUrl = "jdbc:postgresql://" + uri.getHost()
                    + ":" + uri.getPort()
                    + uri.getPath()
                    + "?sslmode=require";

            Map<String, Object> props = new HashMap<>();
            props.put("spring.datasource.url", jdbcUrl);

            if (uri.getUserInfo() != null) {
                String[] parts = uri.getUserInfo().split(":", 2);
                props.put("spring.datasource.username", parts[0]);
                props.put("spring.datasource.password", parts.length > 1 ? parts[1] : "");
            }

            // addFirst — must beat application-prod.properties which contains broken ${PGHOST}:${PGPORT}/...
            // SPRING_DATASOURCE_URL env var (system env) has even higher priority than addFirst,
            // so local docker-compose's explicit override still wins.
            environment.getPropertySources()
                    .addFirst(new MapPropertySource("databaseUrlPropertySource", props));

        } catch (Exception e) {
            // Log to stderr — logging infra not ready yet at this stage
            System.err.println("[DatabaseUrlEnvironmentPostProcessor] Failed to parse DATABASE_URL: " + e.getMessage());
        }
    }
}