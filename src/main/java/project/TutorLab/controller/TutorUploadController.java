package project.TutorLab.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tutors")
public class TutorUploadController {

    private static final Logger log = LoggerFactory.getLogger(TutorUploadController.class);

    @Value("${app.upload.dir:users-photos}")
    private String uploadDir;

    @PostMapping("/upload-photo")
    public ResponseEntity<Map<String, String>> uploadPhoto(@RequestParam("file") MultipartFile file) {
        Map<String, String> response = new HashMap<>();

        if (file.isEmpty()) {
            response.put("error", "Файл не выбран");
            return ResponseEntity.badRequest().body(response);
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            response.put("error", "Файл должен быть изображением");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String filename = UUID.randomUUID().toString() + extension;

            Path filePath = uploadPath.resolve(filename).normalize();
            if (!filePath.startsWith(uploadPath)) {
                response.put("error", "Недопустимое имя файла");
                return ResponseEntity.badRequest().body(response);
            }

            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            String photoUrl = "/api/students/photos/" + filename;
            response.put("photoUrl", photoUrl);
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            log.error("Failed to upload tutor photo: {}", e.getMessage());
            response.put("error", "Ошибка при сохранении файла: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}
