package project.TutorLab.service.impl;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import project.TutorLab.service.PdfService;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class PdfServiceImpl implements PdfService {

    private static final Logger log = LoggerFactory.getLogger(PdfServiceImpl.class);

    @Value("${app.upload.dir:users-photos}")
    private String uploadDir;

    @Override
    public List<String> convertPdfToImages(MultipartFile pdfFile, String sessionId) throws IOException {
        List<String> imageUrls = new ArrayList<>();

        // Создаём папку для слайдов сессии
        Path sessionPath = Paths.get(uploadDir, "slides", sessionId);
        if (!Files.exists(sessionPath)) {
            Files.createDirectories(sessionPath);
        }

        try (PDDocument document = PDDocument.load(pdfFile.getInputStream())) {
            PDFRenderer renderer = new PDFRenderer(document);

            for (int page = 0; page < document.getNumberOfPages(); page++) {
                BufferedImage image = renderer.renderImageWithDPI(page, 150); // 150 DPI

                String filename = String.format("slide-%03d.png", page);
                Path imagePath = sessionPath.resolve(filename);

                ImageIO.write(image, "PNG", imagePath.toFile());

                String imageUrl = "/api/live/slides/" + sessionId + "/" + filename;
                imageUrls.add(imageUrl);
            }
        }

        return imageUrls;
    }

    @Override
    @Async("pdfTaskExecutor")
    public CompletableFuture<List<String>> convertPdfToImagesAsync(byte[] pdfBytes, String sessionId) {
        log.info("Starting async PDF conversion for session={}, bytes={}", sessionId, pdfBytes.length);
        try {
            List<String> imageUrls = new ArrayList<>();
            Path sessionPath = Paths.get(uploadDir, "slides", sessionId);
            if (!Files.exists(sessionPath)) {
                Files.createDirectories(sessionPath);
            }
            try (PDDocument document = PDDocument.load(pdfBytes)) {
                PDFRenderer renderer = new PDFRenderer(document);
                for (int page = 0; page < document.getNumberOfPages(); page++) {
                    BufferedImage image = renderer.renderImageWithDPI(page, 150);
                    String filename = String.format("slide-%03d.png", page);
                    Path imagePath = sessionPath.resolve(filename);
                    ImageIO.write(image, "PNG", imagePath.toFile());
                    imageUrls.add("/api/live/slides/" + sessionId + "/" + filename);
                }
            }
            log.info("PDF conversion done for session={}, slides={}", sessionId, imageUrls.size());
            return CompletableFuture.completedFuture(imageUrls);
        } catch (IOException e) {
            log.error("PDF conversion failed for session={}", sessionId, e);
            return CompletableFuture.failedFuture(e);
        }
    }
}
