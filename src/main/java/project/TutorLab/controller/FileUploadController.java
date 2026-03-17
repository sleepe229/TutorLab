package project.TutorLab.controller;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/students")
@CrossOrigin(origins = "*")
public class FileUploadController {

    private static final Logger log = LoggerFactory.getLogger(FileUploadController.class);

    @Value("${app.upload.dir:users-photos}")
    private String uploadDir;

    @Value("${app.upload.materials.dir:materials}")
    private String materialsDir;

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(Paths.get(uploadDir));
            Files.createDirectories(Paths.get(materialsDir));
            log.info("Upload directories ready: {}, {}", uploadDir, materialsDir);
        } catch (IOException e) {
            log.error("Failed to create upload directories: {}", e.getMessage());
        }
    }

    @PostMapping("/upload-photo")
    public ResponseEntity<Map<String, String>> uploadPhoto(@RequestParam("file") MultipartFile file) {
        Map<String, String> response = new HashMap<>();
        
        if (file.isEmpty()) {
            response.put("error", "Файл не выбран");
            return ResponseEntity.badRequest().body(response);
        }

        // Проверка типа файла
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            response.put("error", "Файл должен быть изображением");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            // Создаем директорию, если её нет
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Генерируем уникальное имя файла
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String filename = UUID.randomUUID().toString() + extension;

            // Сохраняем файл
            Path filePath = uploadPath.resolve(filename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // Возвращаем относительный путь для использования в приложении
            String photoUrl = "/api/students/photos/" + filename;
            response.put("photoUrl", photoUrl);
            
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            response.put("error", "Ошибка при сохранении файла: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/photos/{filename:.+}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable String filename) {
        try {
            Path filePath = Paths.get(uploadDir).resolve(filename).normalize();
            File file = filePath.toFile();
            
            if (!file.exists() || !file.isFile()) {
                return ResponseEntity.notFound().build();
            }

            byte[] imageBytes = Files.readAllBytes(filePath);
            String contentType = Files.probeContentType(filePath);
            
            return ResponseEntity.ok()
                    .header("Content-Type", contentType != null ? contentType : "image/jpeg")
                    .body(imageBytes);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @RequestMapping(value = "/upload-material", method = RequestMethod.OPTIONS)
    public ResponseEntity<?> handleOptions() {
        return ResponseEntity.ok().build();
    }

    @PostMapping("/upload-material")
    public ResponseEntity<Map<String, String>> uploadMaterial(
            @RequestParam("file") MultipartFile file,
            @RequestParam("tutorId") String tutorId,
            @RequestParam("studentId") String studentId) {
        Map<String, String> response = new HashMap<>();
        
        if (file.isEmpty()) {
            response.put("error", "Файл не выбран");
            return ResponseEntity.badRequest().body(response);
        }

        if (tutorId == null || tutorId.isEmpty() || studentId == null || studentId.isEmpty()) {
            response.put("error", "Не указаны ID репетитора или студента");
            return ResponseEntity.badRequest().body(response);
        }

        // Проверка размера файла (макс 10MB)
        if (file.getSize() > 10 * 1024 * 1024) {
            response.put("error", "Размер файла не должен превышать 10MB");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            // Создаем структуру папок: materials/{tutorId}/{studentId}/
            Path tutorPath = Paths.get(materialsDir, tutorId);
            Path studentPath = tutorPath.resolve(studentId);
            
            if (!Files.exists(studentPath)) {
                Files.createDirectories(studentPath);
            }

            // Получаем оригинальное имя файла
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || originalFilename.isEmpty()) {
                originalFilename = "file_" + System.currentTimeMillis();
            }

            // Очищаем имя файла от недопустимых символов, но сохраняем русские буквы
            // Разрешаем: буквы (латиница и кириллица), цифры, точки, дефисы, подчеркивания
            String safeFilename = originalFilename.replaceAll("[^\\p{L}\\p{N}.\\-_]", "_");
            
            // Проверяем, существует ли файл с таким именем
            Path filePath = studentPath.resolve(safeFilename);
            if (Files.exists(filePath)) {
                // Если файл существует, добавляем timestamp перед расширением
                int lastDotIndex = safeFilename.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    String nameWithoutExt = safeFilename.substring(0, lastDotIndex);
                    String extension = safeFilename.substring(lastDotIndex);
                    safeFilename = nameWithoutExt + "_" + System.currentTimeMillis() + extension;
                } else {
                    safeFilename = safeFilename + "_" + System.currentTimeMillis();
                }
                filePath = studentPath.resolve(safeFilename);
            }

            // Сохраняем файл
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // Возвращаем относительный путь для использования в приложении
            String fileUrl = "/api/students/materials/" + tutorId + "/" + studentId + "/" + safeFilename;
            response.put("fileUrl", fileUrl);
            response.put("fileName", safeFilename);
            
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            response.put("error", "Ошибка при сохранении файла: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/materials/{tutorId}/{studentId}/{filename:.+}")
    public ResponseEntity<byte[]> getMaterial(
            @PathVariable String tutorId,
            @PathVariable String studentId,
            @PathVariable String filename) {
        try {
            // Безопасный путь: materials/{tutorId}/{studentId}/{filename}
            Path filePath = Paths.get(materialsDir, tutorId, studentId, filename).normalize();
            
            // Проверяем, что путь находится в правильной директории (защита от path traversal)
            Path basePath = Paths.get(materialsDir, tutorId, studentId).normalize();
            if (!filePath.startsWith(basePath)) {
                return ResponseEntity.badRequest().build();
            }
            
            File file = filePath.toFile();
            
            if (!file.exists() || !file.isFile()) {
                return ResponseEntity.notFound().build();
            }

            byte[] fileBytes = Files.readAllBytes(filePath);
            String contentType = Files.probeContentType(filePath);
            
            return ResponseEntity.ok()
                    .header("Content-Type", contentType != null ? contentType : "application/octet-stream")
                    .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                    .body(fileBytes);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/tutors/upload-photo")
    @CrossOrigin(origins = "*")
    public ResponseEntity<Map<String, String>> uploadTutorPhoto(@RequestParam("file") MultipartFile file) {
        Map<String, String> response = new HashMap<>();
        
        if (file.isEmpty()) {
            response.put("error", "Файл не выбран");
            return ResponseEntity.badRequest().body(response);
        }

        // Проверка типа файла
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            response.put("error", "Файл должен быть изображением");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            // Создаем директорию, если её нет
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Генерируем уникальное имя файла
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String filename = UUID.randomUUID().toString() + extension;

            // Сохраняем файл
            Path filePath = uploadPath.resolve(filename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // Возвращаем относительный путь для использования в приложении
            String photoUrl = "/api/students/photos/" + filename;
            response.put("photoUrl", photoUrl);
            
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            response.put("error", "Ошибка при сохранении файла: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}

