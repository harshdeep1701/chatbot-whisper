# ============================================================
# Stage 1: Build the application with Maven
# ============================================================
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml and download dependencies (layer caching)
COPY pom.xml .
RUN mvn dependency:go-offline -B -q

# Copy source and build
COPY src ./src
RUN mvn package -DskipTests -B -q

# ============================================================
# Stage 2: Runtime with JRE
# ============================================================
FROM eclipse-temurin:17-jre-jammy AS runtime

WORKDIR /app

# Create data directory for H2 database
RUN mkdir -p /app/data /app/logs

# Copy the built JAR from builder stage
COPY --from=builder /app/target/chatbot-whisper-1.0.0.jar app.jar

# Expose backend port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -s http://localhost:8080/api/chat/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
