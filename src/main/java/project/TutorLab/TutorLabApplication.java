package project.TutorLab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TutorLabApplication {

	public static void main(String[] args) {
		SpringApplication.run(TutorLabApplication.class, args);
	}

}
