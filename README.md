# TutorLab

Веб-приложение для репетиторов, решающее массу рутинных задач по организации учебного процесса с поддержкой живых онлайн-уроков.

## Запуск

Нужны Java 21, Node.js, Docker.

```bash
# Redis
docker-compose up -d

# Backend (порт 8080)
./mvnw spring-boot:run

# Frontend (порт 3000)
cd frontend && npm install && npm run dev
```

## Что умеет

**Репетитор**
- Список учеников с карточками: расписание, материалы, оплата, избранное
- Календарь занятий с навигацией по месяцам
- Публичный профиль для маркетплейса (предметы, ставка, описание)
- Чат с учениками

**Ученик**
- Личный кабинет: профили у разных репетиторов, материалы, расписание
- Регистрация/вход по email
- Подключение к уроку по ссылке без аккаунта

**Живой урок**
- Загрузка PDF — автоматическая конвертация в слайды на сервере
- Рисование на слайдах в реальном времени (ручка, ластик, указатель, очистка)
- Синхронизация через WebSocket: ученик видит то, что делает преподаватель
- WebRTC аудио/видео в обе стороны
- Демонстрация экрана

## Стек

| Слой | Технологии |
|------|-----------|
| Backend | Java 21, Spring Boot 3, Redis (без SQL), Apache PDFBox |
| Auth | JWT (access 15 мин) + refresh token (30 дней в Redis), BCrypt |
| Real-time | STOMP over SockJS, WebRTC (simple-peer) |
| Frontend | React 18, Vite, React Router, Axios |
| Инфра | Docker, nginx (prod), Testcontainers (тесты) |

## Архитектура

Данные хранятся только в Redis. TTL: 30 дней для репетиторов и учеников, 6 часов для живых сессий.

```
/api/tutors/        — CRUD репетиторов, логин/регистрация
/api/students/      — CRUD учеников, материалы, расписание
/api/students/auth/ — аутентификация учеников (JWT)
/api/live/          — сессии, загрузка PDF, слайды
/api/auth/          — refresh/logout для репетиторов
/ws                 — WebSocket (STOMP)
```

WebSocket-топики: `session.{id}.slide`, `.draw`, `.pointer`, `.clear`, `.presentation`, `.webrtc`.

## Тесты

```bash
# Backend (26 тестов)
./mvnw test

# Frontend
cd frontend && npm test
```

Unit-тесты: JwtService, AuthInterceptor, TutorService, LiveSessionService.
Интеграционные: TutorController через Testcontainers с реальным Redis.

## Локальное тестирование в Docker

Проверить prod-сборку локально, не трогая production-данные:

```bash
docker compose -f docker-compose.local.yml up --build
```

Приложение доступно на `http://localhost:8080`

## Продакшн

```bash
docker compose -f docker-compose.prod.yml up -d
```

Собирает один Docker-образ: Spring Boot + собранный frontend. Nginx проксирует `/api`, `/ws` на бэкенд и отдаёт SPA для остального.

Переменные окружения: `REDIS_PASSWORD`, `JWT_SECRET`, `APP_CORS_ALLOWED_ORIGINS` — см. `.env.example`.
