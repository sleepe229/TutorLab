package project.TutorLab.service;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public interface PdfService {
    List<String> convertPdfToImages(MultipartFile pdfFile, String sessionId) throws IOException;
    CompletableFuture<List<String>> convertPdfToImagesAsync(byte[] pdfBytes, String sessionId);
}
