package project.TutorLab.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // Разрешаем все источники
        config.addAllowedOriginPattern("*");
        
        // Разрешаем все методы HTTP
        config.addAllowedMethod("*");
        
        // Разрешаем все заголовки
        config.addAllowedHeader("*");
        
        // Разрешаем отправку credentials
        config.setAllowCredentials(true);
        
        // Разрешаем preflight запросы
        config.setMaxAge(3600L);
        
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}

