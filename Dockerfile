# ── Stage 1: Build backend ──────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS backend-builder
WORKDIR /app
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw dependency:go-offline -q
COPY src src
RUN ./mvnw package -DskipTests -q

# ── Stage 2: Build frontend ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ .
ARG VITE_API_URL=
ARG VITE_WS_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npx vite build

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S tutorlab && adduser -S tutorlab -G tutorlab
WORKDIR /app

COPY --from=backend-builder /app/target/TutorLab-*.jar app.jar
# Frontend dist served by Spring Boot as static resources from /app/static
COPY --from=frontend-builder /frontend/dist /app/static

# Create upload dirs with correct ownership
RUN mkdir -p /app/uploads/slides /app/uploads/materials /app/users-photos \
    && chown -R tutorlab:tutorlab /app

USER tutorlab
EXPOSE 8080

# Volume hint — mount a persistent volume to /app/uploads in docker-compose
VOLUME ["/app/uploads"]

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
