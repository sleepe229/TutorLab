package project.TutorLab.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure URL parsing tests — no Spring context required.
 * Tests the DATABASE_URL → JDBC URL conversion logic.
 */
class DatabaseUrlEnvironmentPostProcessorTest {

    private final DatabaseUrlEnvironmentPostProcessor processor = new DatabaseUrlEnvironmentPostProcessor();
    private final SpringApplication app = new SpringApplication();

    @Test
    void postgres_url_convertedToJdbcUrl() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("DATABASE_URL", "postgres://alice:secret@db.example.com:5432/mydb");

        processor.postProcessEnvironment(env, app);

        String jdbcUrl = env.getProperty("spring.datasource.url");
        assertNotNull(jdbcUrl, "JDBC url should be set");
        assertTrue(jdbcUrl.startsWith("jdbc:postgresql://db.example.com:5432/mydb"),
                "Expected correct JDBC URL but got: " + jdbcUrl);
        assertTrue(jdbcUrl.contains("sslmode=require"));
    }

    @Test
    void postgres_url_extractsUsernameAndPassword() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("DATABASE_URL", "postgres://user1:pass123@host.example.com:5432/appdb");

        processor.postProcessEnvironment(env, app);

        assertEquals("user1", env.getProperty("spring.datasource.username"));
        assertEquals("pass123", env.getProperty("spring.datasource.password"));
    }

    @Test
    void postgresql_prefix_alsoConverted() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("DATABASE_URL", "postgresql://bob:pw@host.example.com:5432/db");

        processor.postProcessEnvironment(env, app);

        String jdbcUrl = env.getProperty("spring.datasource.url");
        assertNotNull(jdbcUrl);
        assertTrue(jdbcUrl.startsWith("jdbc:postgresql://"));
    }

    @Test
    void no_DATABASE_URL_isNoOp() {
        MockEnvironment env = new MockEnvironment();

        processor.postProcessEnvironment(env, app);

        assertNull(env.getProperty("spring.datasource.url"));
    }

    @Test
    void blank_DATABASE_URL_isNoOp() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("DATABASE_URL", "   ");

        processor.postProcessEnvironment(env, app);

        assertNull(env.getProperty("spring.datasource.url"));
    }
}
