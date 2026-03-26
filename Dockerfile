# ── Backend build ─────────────────────────
FROM eclipse-temurin:21-jdk-jammy AS backend-builder
WORKDIR /app

COPY pom.xml mvnw ./
COPY .mvn .mvn

RUN --mount=type=cache,target=/root/.m2 \
    chmod +x mvnw && ./mvnw dependency:go-offline -q

COPY src src

RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw package -DskipTests -q \
    && mv target/*jar target/app.jar


# ── Frontend build ────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --silent

COPY frontend/ .
RUN npm run build


# ── Runtime ───────────────────────────────
FROM eclipse-temurin:21-jre-alpine

RUN apk add --no-cache tini ca-certificates \
 && update-ca-certificates \
 && addgroup -S tutorlab \
 && adduser -S tutorlab -G tutorlab

WORKDIR /app

COPY --from=backend-builder /app/target/app.jar app.jar
COPY --from=frontend-builder /frontend/dist /app/static

RUN mkdir -p /app/uploads/slides /app/uploads/materials /app/users-photos \
 && chown -R tutorlab:tutorlab /app

USER tutorlab

EXPOSE 8080
VOLUME ["/app/uploads"]

ENTRYPOINT ["tini","--","java","-XX:MaxRAMPercentage=75.0","-jar","app.jar"]