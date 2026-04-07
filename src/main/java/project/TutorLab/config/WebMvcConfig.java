package project.TutorLab.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private AuthInterceptor authInterceptor;

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/tutors/register",
                        "/api/tutors/login",
                        "/api/tutors/auth/google",
                        "/api/tutors/*/exists",
                        "/api/tutors/login/*/exists",
                        "/api/live/sessions/*",
                        "/api/live/sessions/tutor/*",
                        "/api/live/sessions/*/presentation",
                        "/api/live/sessions/*/slides/*/drawings",
                        "/api/live/ice-config",
                        "/api/live/slides/**",
                        "/api/upload/**",
                        "/api/students/*/view",
                        "/api/students/photos/**",
                        "/api/students/materials/**",
                        "/api/students/upload-photo",
                        "/api/students/upload-material",
                        "/api/auth/refresh",
                        "/api/auth/logout",
                        "/api/students/auth/**",
                        "/api/tutors/public",
                        "/api/tutors/*/profile",
                        "/api/chats/**",
                        "/api/join/**",
                        // Recap is UUID-protected (unguessable), no auth needed
                        "/api/live/recap/**",
                        // Progress notes: dual-auth (tutor or student) handled in controller
                        "/api/students/*/progress-notes"
                );
    }
}
