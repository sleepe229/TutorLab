package project.TutorLab.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import project.TutorLab.service.ViteManifestService;

import java.nio.charset.StandardCharsets;

/**
 * Server-side renders static SEO pages (/privacy, /terms, /about).
 * The pre-rendered HTML is indexed by crawlers; React hydrates it for interactive users.
 */
@Controller
public class StaticPageController {

    private final ViteManifestService viteManifestService;

    public StaticPageController(ViteManifestService viteManifestService) {
        this.viteManifestService = viteManifestService;
    }

    @GetMapping(value = "/about", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> aboutPage() {
        return htmlResponse(buildAboutHtml());
    }

    @GetMapping(value = "/privacy", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> privacyPage() {
        return htmlResponse(buildPrivacyHtml());
    }

    @GetMapping(value = "/terms", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> termsPage() {
        return htmlResponse(buildTermsHtml());
    }

    private ResponseEntity<String> htmlResponse(String html) {
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
                .body(html);
    }

    // ── /about ──────────────────────────────────────────────────────────────

    private String buildAboutHtml() {
        String extraHead =
                "<meta property=\"og:title\" content=\"О платформе TutorLab\">\n" +
                "<meta property=\"og:description\" content=\"TutorLab — онлайн-инструмент для репетиторов: управление учениками, живые уроки с интерактивной доской и маркетплейс репетиторов.\">\n" +
                "<meta property=\"og:url\" content=\"https://tutorlab.onrender.com/about\">\n" +
                "<meta property=\"og:image\" content=\"https://tutorlab.onrender.com/og-image.svg\">\n" +
                buildPersonSchema();

        String body =
                "<nav style=\"position:sticky;top:0;z-index:100;background:#0D1117;border-bottom:1px solid #30363D;padding:0 24px;height:60px;display:flex;align-items:center;gap:10px;\">" +
              "<a href=\"/home\" style=\"display:flex;align-items:center;gap:10px;text-decoration:none;\">" +
                "<div style=\"width:34px;height:34px;background:#5B73F5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;\">TL</div>" +
                "<span style=\"font-size:17px;font-weight:700;color:#F0F6FC;\">TutorLab</span>" +
              "</a>" +
            "</nav>" +
            "<main style=\"max-width:800px;margin:0 auto;padding:60px 24px;\">" +
              "<h1 style=\"font-size:36px;font-weight:700;color:#F0F6FC;margin:0 0 16px;\">О платформе TutorLab</h1>" +
              "<p style=\"font-size:17px;color:#8B949E;line-height:1.7;margin:0 0 40px;\">" +
                "TutorLab — бесплатный онлайн-инструмент для частных репетиторов. Платформа объединяет " +
                "всё необходимое для работы: управление учениками, планирование расписания, живые " +
                "онлайн-уроки с интерактивной доской и публичный маркетплейс для поиска учеников." +
              "</p>" +

              "<h2 style=\"font-size:22px;font-weight:700;color:#F0F6FC;margin:0 0 16px;\">Возможности</h2>" +
              "<ul style=\"font-size:16px;color:#8B949E;line-height:1.8;padding-left:20px;margin:0 0 40px;\">" +
                "<li>Управление списком учеников: профили, заметки, история занятий</li>" +
                "<li>Живые онлайн-уроки с синхронной интерактивной доской</li>" +
                "<li>Загрузка PDF-презентаций с автоматическим переводом в слайды</li>" +
                "<li>Видео и аудио связь через WebRTC прямо в браузере</li>" +
                "<li>Расписание занятий с календарным видом</li>" +
                "<li>Личный кабинет ученика с доступом к материалам и истории</li>" +
                "<li>Маркетплейс репетиторов для поиска новых учеников</li>" +
              "</ul>" +

              "<h2 style=\"font-size:22px;font-weight:700;color:#F0F6FC;margin:0 0 16px;\">Технологии</h2>" +
              "<p style=\"font-size:16px;color:#8B949E;line-height:1.7;margin:0 0 40px;\">" +
                "Бэкенд: Spring Boot (Java 21) + Redis. Фронтенд: React. " +
                "Видеосвязь: WebRTC (simple-peer). Доска: Canvas API + WebSocket (STOMP/SockJS). " +
                "Хостинг: Render.com." +
              "</p>" +

              "<h2 style=\"font-size:22px;font-weight:700;color:#F0F6FC;margin:0 0 16px;\">Контакты</h2>" +
              "<p style=\"font-size:16px;color:#8B949E;\">" +
                "Поддержка: <a href=\"mailto:support@tutorlab.ru\" style=\"color:#5B73F5;\">support@tutorlab.ru</a>" +
              "</p>" +
              "<p style=\"margin-top:8px;\">" +
                "<a href=\"/home\" style=\"color:#5B73F5;font-size:16px;\">Найти репетитора →</a>" +
              "</p>" +
            "</main>";

        return buildHtmlShell(
                "О платформе — TutorLab",
                "TutorLab — бесплатный онлайн-инструмент для репетиторов: управление учениками, живые уроки с интерактивной доской, маркетплейс.",
                "/about",
                extraHead,
                body
        );
    }

    private String buildPersonSchema() {
        return "<script type=\"application/ld+json\">" +
               "{\"@context\":\"https://schema.org\",\"@type\":\"WebPage\"," +
               "\"name\":\"О платформе TutorLab\"," +
               "\"url\":\"https://tutorlab.onrender.com/about\"," +
               "\"description\":\"TutorLab — онлайн-платформа для репетиторов: управление учениками, живые уроки с интерактивной доской, маркетплейс.\"," +
               "\"publisher\":{\"@id\":\"https://tutorlab.onrender.com/#organization\"}}" +
               "</script>\n";
    }

    // ── /privacy ─────────────────────────────────────────────────────────────

    private String buildPrivacyHtml() {
        String extraHead =
                "<meta property=\"og:title\" content=\"Политика конфиденциальности — TutorLab\">\n" +
                "<meta property=\"og:url\" content=\"https://tutorlab.onrender.com/privacy\">\n";

        String body =
            "<nav style=\"position:sticky;top:0;z-index:100;background:#0D1117;border-bottom:1px solid #30363D;padding:0 24px;height:60px;display:flex;align-items:center;gap:10px;\">" +
              "<a href=\"/home\" style=\"display:flex;align-items:center;gap:10px;text-decoration:none;\">" +
                "<div style=\"width:34px;height:34px;background:#5B73F5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;\">TL</div>" +
                "<span style=\"font-size:17px;font-weight:700;color:#F0F6FC;\">TutorLab</span>" +
              "</a>" +
            "</nav>" +
            "<main style=\"max-width:800px;margin:0 auto;padding:60px 24px;\">" +
              "<h1 style=\"font-size:32px;font-weight:700;color:#F0F6FC;margin:0 0 8px;\">Политика конфиденциальности</h1>" +
              "<p style=\"font-size:14px;color:#8B949E;margin:0 0 40px;\">Последнее обновление: 20 марта 2026 г.</p>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">1. Общие положения</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Настоящая Политика конфиденциальности регулирует порядок обработки персональных данных пользователей сервиса TutorLab (далее — «Платформа», «мы»), доступного по адресу https://tutorlab.onrender.com. Обработка персональных данных осуществляется в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">2. Какие данные мы собираем</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;margin-bottom:8px;\">При регистрации и использовании Платформы мы можем собирать следующие данные:</p>" +
              "<ul style=\"font-size:15px;color:#8B949E;line-height:1.8;padding-left:20px;\">" +
                "<li>Имя и фамилия (для профиля репетитора и аккаунта ученика);</li>" +
                "<li>Адрес электронной почты (для аккаунта ученика);</li>" +
                "<li>Логин репетитора;</li>" +
                "<li>Фотография профиля (по желанию);</li>" +
                "<li>Информация об уроках: даты, заметки, учебные материалы;</li>" +
                "<li>Технические данные: IP-адрес, тип браузера, журналы запросов.</li>" +
              "</ul></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">3. Цели обработки данных</h2>" +
              "<ul style=\"font-size:15px;color:#8B949E;line-height:1.8;padding-left:20px;\">" +
                "<li>Предоставления функциональности Платформы (управление учениками, онлайн-уроки, расписание);</li>" +
                "<li>Обеспечения безопасности аккаунтов и аутентификации пользователей;</li>" +
                "<li>Улучшения качества сервиса;</li>" +
                "<li>Связи с пользователями по вопросам поддержки.</li>" +
              "</ul></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">4. Хранение данных</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Данные пользователей хранятся в базе данных Redis с ограниченным сроком хранения. Профили репетиторов и учеников хранятся 30 дней с момента последней активности. Данные живых сессий хранятся 6 часов. Снимки сессий хранятся 365 дней.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">5. Передача данных третьим лицам</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением случаев, предусмотренных законодательством Российской Федерации, или с вашего явного согласия. Платформа использует облачную инфраструктуру Render.com (США) для размещения сервиса.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">6. Права пользователей</h2>" +
              "<ul style=\"font-size:15px;color:#8B949E;line-height:1.8;padding-left:20px;\">" +
                "<li>Получить доступ к своим персональным данным;</li>" +
                "<li>Запросить исправление или удаление своих данных;</li>" +
                "<li>Отозвать согласие на обработку персональных данных.</li>" +
              "</ul>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;margin-top:8px;\">Для реализации своих прав обратитесь на адрес: <a href=\"mailto:support@tutorlab.ru\" style=\"color:#5B73F5;\">support@tutorlab.ru</a>.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">7. Cookies и сессии</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Платформа использует localStorage браузера для хранения токенов аутентификации. Сторонние рекламные или аналитические куки не используются.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">8. Изменения политики</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Мы оставляем за собой право обновлять настоящую Политику. При существенных изменениях мы уведомим пользователей. Продолжение использования Платформы после публикации изменений означает ваше согласие с обновлённой Политикой.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">9. Контакты</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;\">По вопросам обработки персональных данных обращайтесь: <a href=\"mailto:support@tutorlab.ru\" style=\"color:#5B73F5;\">support@tutorlab.ru</a></p></section>" +
            "</main>";

        return buildHtmlShell(
                "Политика конфиденциальности — TutorLab",
                "Политика конфиденциальности TutorLab: как мы собираем, используем и защищаем ваши персональные данные в соответствии с ФЗ-152.",
                "/privacy",
                extraHead,
                body
        );
    }

    // ── /terms ───────────────────────────────────────────────────────────────

    private String buildTermsHtml() {
        String extraHead =
                "<meta property=\"og:title\" content=\"Условия использования — TutorLab\">\n" +
                "<meta property=\"og:url\" content=\"https://tutorlab.onrender.com/terms\">\n";

        String body =
            "<nav style=\"position:sticky;top:0;z-index:100;background:#0D1117;border-bottom:1px solid #30363D;padding:0 24px;height:60px;display:flex;align-items:center;gap:10px;\">" +
              "<a href=\"/home\" style=\"display:flex;align-items:center;gap:10px;text-decoration:none;\">" +
                "<div style=\"width:34px;height:34px;background:#5B73F5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;\">TL</div>" +
                "<span style=\"font-size:17px;font-weight:700;color:#F0F6FC;\">TutorLab</span>" +
              "</a>" +
            "</nav>" +
            "<main style=\"max-width:800px;margin:0 auto;padding:60px 24px;\">" +
              "<h1 style=\"font-size:32px;font-weight:700;color:#F0F6FC;margin:0 0 8px;\">Условия использования</h1>" +
              "<p style=\"font-size:14px;color:#8B949E;margin:0 0 40px;\">Последнее обновление: 20 марта 2026 г.</p>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">1. Предмет соглашения</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Настоящие Условия использования (далее — «Условия») регулируют доступ к платформе TutorLab и её использование, доступной по адресу https://tutorlab.onrender.com. Используя Платформу, вы принимаете настоящие Условия в полном объёме.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">2. Описание сервиса</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">TutorLab — онлайн-платформа, предоставляющая репетиторам инструменты для управления учениками, планирования расписания и проведения живых онлайн-уроков с интерактивной доской и поддержкой PDF-презентаций. Ученики получают доступ к личному кабинету, истории занятий и учебным материалам.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">3. Регистрация и аккаунт</h2>" +
              "<ul style=\"font-size:15px;color:#8B949E;line-height:1.8;padding-left:20px;\">" +
                "<li>Для использования полных функций Платформы необходима регистрация.</li>" +
                "<li>Вы обязаны предоставить достоверные сведения при регистрации.</li>" +
                "<li>Вы несёте ответственность за сохранность учётных данных вашего аккаунта.</li>" +
                "<li>Передача аккаунта третьим лицам запрещена.</li>" +
              "</ul></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">4. Правила использования</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;margin-bottom:8px;\">При использовании Платформы запрещается:</p>" +
              "<ul style=\"font-size:15px;color:#8B949E;line-height:1.8;padding-left:20px;\">" +
                "<li>Распространять незаконный, оскорбительный или вредоносный контент;</li>" +
                "<li>Нарушать права интеллектуальной собственности третьих лиц;</li>" +
                "<li>Осуществлять автоматизированный сбор данных (парсинг) без разрешения;</li>" +
                "<li>Предпринимать попытки несанкционированного доступа к системам Платформы;</li>" +
                "<li>Использовать Платформу в мошеннических или незаконных целях.</li>" +
              "</ul></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">5. Контент пользователей</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Загружая материалы (фотографии, документы, записи уроков), вы подтверждаете наличие необходимых прав на такой контент и предоставляете Платформе разрешение на его хранение и отображение в рамках функциональности сервиса.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">6. Ограничение ответственности</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Платформа предоставляется «как есть». Мы не гарантируем бесперебойную работу сервиса и не несём ответственности за косвенные убытки, возникшие в результате использования или невозможности использования Платформы.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">7. Интеллектуальная собственность</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Все права на программное обеспечение, дизайн и торговые марки Платформы принадлежат TutorLab. Использование этих материалов без письменного разрешения запрещено.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">8. Изменение и прекращение сервиса</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Мы оставляем за собой право изменять, приостанавливать или прекращать работу Платформы в любое время. Мы также можем заблокировать аккаунт пользователя при нарушении настоящих Условий.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">9. Применимое право</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;line-height:1.7;\">Настоящие Условия регулируются законодательством Российской Федерации. Все споры разрешаются в судебном порядке по месту нахождения ответчика.</p></section>" +

              "<section style=\"margin-bottom:32px;\"><h2 style=\"font-size:20px;font-weight:700;color:#F0F6FC;margin:0 0 12px;\">10. Контакты</h2>" +
              "<p style=\"font-size:15px;color:#8B949E;\">По вопросам, связанным с настоящими Условиями: <a href=\"mailto:support@tutorlab.ru\" style=\"color:#5B73F5;\">support@tutorlab.ru</a></p></section>" +
            "</main>";

        return buildHtmlShell(
                "Условия использования — TutorLab",
                "Условия использования платформы TutorLab: правила работы сервиса для репетиторов и учеников.",
                "/terms",
                extraHead,
                body
        );
    }

    // ── Shared HTML builder ───────────────────────────────────────────────────

    private String buildHtmlShell(String title, String description, String canonicalPath,
                                   String extraHead, String bodyContent) {
        String js = viteManifestService.getMainJsPath();
        String css = viteManifestService.getMainCssPath();
        String cssLink = css != null ? "<link rel=\"stylesheet\" href=\"" + css + "\">\n" : "";

        return "<!DOCTYPE html>\n<html lang=\"ru\">\n<head>\n" +
               "<meta charset=\"UTF-8\">\n" +
               "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
               "<title>" + TutorsPageController.escapeHtml(title) + "</title>\n" +
               "<meta name=\"description\" content=\"" + TutorsPageController.escapeHtml(description) + "\">\n" +
               "<link rel=\"canonical\" href=\"https://tutorlab.onrender.com" + canonicalPath + "\">\n" +
               "<link rel=\"icon\" type=\"image/svg+xml\" href=\"/favicon.svg\">\n" +
               "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n" +
               "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n" +
               "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;900&family=Inter:wght@400;500;600&display=swap\">\n" +
               extraHead +
               cssLink +
               "</head>\n<body style=\"margin:0;font-family:'Golos Text',system-ui,sans-serif;background:#0D1117;color:#F0F6FC;\">\n" +
               "<div id=\"root\">" + bodyContent + "</div>\n" +
               "<script type=\"module\" src=\"" + js + "\"></script>\n" +
               "</body>\n</html>";
    }
}