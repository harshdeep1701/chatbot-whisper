# ============================================================
# Stage 1: Build the Angular app
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --loglevel=warn

# Copy source and build for production
COPY . .
RUN npm run build -- --configuration=production

# ============================================================
# Stage 2: Serve with Nginx
# ============================================================
FROM nginx:1.27-alpine AS runtime

# Install envsubst (part of gettext) and curl for health check
RUN apk add --no-cache curl gettext

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built Angular app from builder stage
COPY --from=builder /app/dist/chatbot-whisper/browser /usr/share/nginx/html

# Expose HTTP (80) — HTTPS handled externally by Certbot or reverse proxy
EXPOSE 80

# Use custom entrypoint to substitute environment variables
ENTRYPOINT ["/docker-entrypoint.sh"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -s http://localhost:80/ || exit 1
