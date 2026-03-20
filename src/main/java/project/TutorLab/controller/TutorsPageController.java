package project.TutorLab.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import project.TutorLab.dto.TutorResponseDto;
import project.TutorLab.service.TutorService;
import project.TutorLab.service.ViteManifestService;

import java.util.List;

/**
 * Server-side renders the tutor marketplace page so crawlers see real content
 * instead of an empty React shell. React loads afterwards and takes over.
 */
@Controller
public class TutorsPageController {

    private final TutorService tutorService;
    private final ViteManifestService viteManifestService;

    public TutorsPageController(TutorService tutorService, ViteManifestService viteManifestService) {
        this.tutorService = tutorService;
        this.viteManifestService = viteManifestService;
    }

    @GetMapping(value = "/tutors", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> tutorsPage() {
        List<TutorResponseDto> tutors = tutorService.getPublicTutors();
        String html = buildTutorsHtml(tutors);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "html", java.nio.charset.StandardCharsets.UTF_8))
                .body(html);
    }

    private String buildTutorsHtml(List<TutorResponseDto> tutors) {
        String js = viteManifestService.getMainJsPath();
        String css = viteManifestService.getMainCssPath();

        StringBuilder head = new StringBuilder();
        head.append("<meta property=\"og:title\" content=\"Репетиторы онлайн — TutorLab\">\n");
        head.append("<meta property=\"og:description\" content=\"Найдите репетитора для онлайн-занятий. Математика, физика, английский и другие предметы.\">\n");
        head.append("<meta property=\"og:url\" content=\"https://tutorlab.onrender.com/tutors\">\n");
        head.append("<meta property=\"og:image\" content=\"https://tutorlab.onrender.com/og-image.svg\">\n");
        head.append("<meta property=\"og:type\" content=\"website\">\n");
        head.append("<meta property=\"og:locale\" content=\"ru_RU\">\n");
        head.append("<meta name=\"twitter:card\" content=\"summary_large_image\">\n");
        head.append("<meta name=\"twitter:image\" content=\"https://tutorlab.onrender.com/og-image.svg\">\n");
        head.append(buildSchemaScript(tutors));

        StringBuilder body = new StringBuilder();
        body.append("<nav style=\"background:#0D1117;border-bottom:1px solid #30363D;padding:0 24px;height:60px;display:flex;align-items:center;gap:10px;\">");
        body.append("<a href=\"/tutors\" style=\"display:flex;align-items:center;gap:10px;text-decoration:none;\">");
        body.append("<div style=\"width:34px;height:34px;background:#5B73F5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;flex-shrink:0;\">TL</div>");
        body.append("<span style=\"font-size:17px;font-weight:700;color:#F0F6FC;\">TutorLab</span></a>");
        body.append("<span style=\"font-size:14px;color:#8B949E;margin-left:4px;\">Репетиторы</span>");
        body.append("</nav>");
        body.append("<main style=\"max-width:1100px;margin:0 auto;padding:40px 24px 60px;\">");
        body.append("<h1 style=\"font-size:32px;font-weight:700;color:#F0F6FC;margin:0 0 8px;\">Найдите своего репетитора</h1>");
        body.append("<p style=\"font-size:15px;color:#8B949E;margin:0 0 32px;\">Просматривайте анкеты преподавателей и выбирайте подходящего</p>");

        if (tutors.isEmpty()) {
            body.append("<p style=\"color:#8B949E;\">Нет доступных репетиторов</p>");
        } else {
            body.append("<p style=\"font-size:15px;font-weight:600;color:#8B949E;margin:0 0 16px;\">Репетиторы (")
                .append(tutors.size()).append(")</p>");
            body.append("<div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;\">");
            for (TutorResponseDto t : tutors) {
                body.append(buildTutorCard(t));
            }
            body.append("</div>");
        }

        body.append("</main>");

        return buildHtmlShell(
                "Репетиторы онлайн — TutorLab | Найдите преподавателя",
                "Найдите репетитора для онлайн-занятий на TutorLab. Фильтрация по предмету и цене. Математика, физика, английский и другие предметы.",
                "/tutors",
                head.toString(),
                body.toString(),
                js,
                css
        );
    }

    private String buildTutorCard(TutorResponseDto t) {
        StringBuilder card = new StringBuilder();
        card.append("<article style=\"background:#161B22;border:1px solid #30363D;border-radius:16px;padding:20px;\">");

        // Header
        card.append("<div style=\"display:flex;align-items:center;gap:14px;margin-bottom:12px;\">");
        card.append("<div style=\"width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#5B73F5,#7c8ff5);color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;\">")
            .append(getInitials(t.getFullName())).append("</div>");
        card.append("<div><h2 style=\"font-size:16px;font-weight:700;color:#F0F6FC;margin:0 0 4px;\">")
            .append(escapeHtml(t.getFullName())).append("</h2>");
        if (t.getHourlyRate() != null) {
            card.append("<span style=\"font-size:13px;font-weight:600;color:#FF6B35;\">")
                .append(t.getHourlyRate()).append(" ₽/час</span>");
        }
        card.append("</div></div>");

        // Subjects
        if (t.getSubjects() != null && !t.getSubjects().isEmpty()) {
            card.append("<div style=\"display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;\">");
            for (String s : t.getSubjects()) {
                card.append("<span style=\"background:rgba(91,115,245,0.1);color:#5B73F5;border:1px solid rgba(91,115,245,0.2);border-radius:6px;padding:3px 10px;font-size:12px;font-weight:500;\">")
                    .append(escapeHtml(s)).append("</span>");
            }
            card.append("</div>");
        }

        // About
        if (t.getAbout() != null && !t.getAbout().isBlank()) {
            String about = t.getAbout().length() > 200 ? t.getAbout().substring(0, 200) + "…" : t.getAbout();
            card.append("<p style=\"font-size:13px;color:#8B949E;line-height:1.5;margin:0 0 12px;\">")
                .append(escapeHtml(about)).append("</p>");
        }

        card.append("</article>");
        return card.toString();
    }

    private String buildSchemaScript(List<TutorResponseDto> tutors) {
        if (tutors.isEmpty()) return "";
        StringBuilder json = new StringBuilder();
        json.append("{\"@context\":\"https://schema.org\",\"@type\":\"ItemList\",");
        json.append("\"name\":\"Репетиторы на TutorLab\",");
        json.append("\"url\":\"https://tutorlab.onrender.com/tutors\",");
        json.append("\"numberOfItems\":").append(tutors.size()).append(",");
        json.append("\"itemListElement\":[");
        for (int i = 0; i < tutors.size(); i++) {
            TutorResponseDto t = tutors.get(i);
            if (i > 0) json.append(",");
            json.append("{\"@type\":\"ListItem\",\"position\":").append(i + 1).append(",");
            json.append("\"item\":{\"@type\":\"Service\",");
            String name = (t.getSubjects() != null && !t.getSubjects().isEmpty())
                    ? "Репетитор по " + String.join(", ", t.getSubjects()) + " — " + t.getFullName()
                    : "Репетитор " + t.getFullName();
            json.append("\"name\":\"").append(escapeJson(name)).append("\",");
            json.append("\"serviceType\":\"Репетиторство\",");
            json.append("\"provider\":{\"@type\":\"Person\",\"name\":\"").append(escapeJson(t.getFullName())).append("\"");
            if (t.getAbout() != null && !t.getAbout().isBlank()) {
                json.append(",\"description\":\"").append(escapeJson(t.getAbout())).append("\"");
            }
            json.append("}");
            if (t.getHourlyRate() != null) {
                json.append(",\"offers\":{\"@type\":\"Offer\",\"price\":\"").append(t.getHourlyRate())
                    .append("\",\"priceCurrency\":\"RUB\"}");
            }
            json.append("}}");
        }
        json.append("]}");
        return "<script type=\"application/ld+json\">" + json + "</script>\n";
    }

    private static String buildHtmlShell(String title, String description, String canonicalPath,
                                          String extraHead, String bodyContent,
                                          String jsPath, String cssPath) {
        String cssLink = cssPath != null
                ? "<link rel=\"stylesheet\" href=\"" + cssPath + "\">\n"
                : "";
        return "<!DOCTYPE html>\n<html lang=\"ru\">\n<head>\n" +
               "<meta charset=\"UTF-8\">\n" +
               "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
               "<title>" + escapeHtml(title) + "</title>\n" +
               "<meta name=\"description\" content=\"" + escapeHtml(description) + "\">\n" +
               "<link rel=\"canonical\" href=\"https://tutorlab.onrender.com" + canonicalPath + "\">\n" +
               "<link rel=\"icon\" type=\"image/svg+xml\" href=\"/favicon.svg\">\n" +
               "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n" +
               "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n" +
               "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;900&family=Inter:wght@400;500;600&display=swap\">\n" +
               extraHead +
               cssLink +
               "</head>\n<body style=\"margin:0;font-family:'Golos Text',system-ui,sans-serif;background:#0D1117;color:#F0F6FC;\">\n" +
               "<div id=\"root\">" + bodyContent + "</div>\n" +
               "<script type=\"module\" src=\"" + jsPath + "\"></script>\n" +
               "</body>\n</html>";
    }

    static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private static String getInitials(String name) {
        if (name == null || name.isBlank()) return "?";
        String[] parts = name.trim().split("\\s+");
        if (parts.length >= 2) return escapeHtml(String.valueOf(parts[0].charAt(0)) + parts[1].charAt(0)).toUpperCase();
        return escapeHtml(name.substring(0, Math.min(2, name.length()))).toUpperCase();
    }
}