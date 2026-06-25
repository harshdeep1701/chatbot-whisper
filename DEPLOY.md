# Cosmo-Chat — VPS Deployment Guide

This guide walks you through deploying Cosmo-Chat on an Ubuntu VPS using Docker Compose.

---

## Prerequisites

- **Ubuntu 22.04+** VPS with root or sudo access
- **A domain name** pointed to your VPS IP address (A record)
- **Ports 80 and 443** open in your firewall

## 1. Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in, or run: newgrp docker

# Verify
docker --version
docker compose version
```

## 2. Clone and Configure

```bash
git clone <your-repo-url> cosmo-chat
cd cosmo-chat

# Create environment file from the example
cp .env.example .env

# Edit .env with your real API keys and domain
nano .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `DEEPSEEK_API_KEY` | Your DeepSeek API key |
| `OPENAI_API_KEY` | Your OpenAI API key (for Whisper STT/TTS) |
| `GEMINI_API_KEY` | Your Google AI Gemini API key |
| `JWT_SECRET` | A random 32+ char string (`openssl rand -base64 32`) |
| `DOMAIN_NAME` | Your domain, e.g. `chat.yourdomain.com` |

## 3. Start the Application

```bash
docker compose up -d --build
```

This builds and starts both services:

| Service | Container Name | Port |
|---|---|---|
| Backend (Spring Boot) | `cosmo-chat-backend` | 8080 |
| Frontend (Nginx) | `cosmo-chat-frontend` | 80 |

Check logs:
```bash
docker compose logs -f
```

## 4. Set Up HTTPS with Certbot

```bash
# Run Certbot to get SSL certificates
docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN_NAME}
```

Then:

1. Uncomment the `443:443` port mapping in `docker-compose.yml` under the `frontend` service
2. Create `frontend/nginx-ssl.conf` (or uncomment SSL sections in nginx.conf) and restart:

```bash
docker compose up -d --build frontend
```

> **Alternative:** Install Certbot directly on the host:
> ```bash
> sudo apt install certbot python3-certbot-nginx
> sudo certbot --nginx -d your-domain.com
> ```

## 5. Verify

- Visit `https://your-domain.com` — you should see the Cosmo-Chat login page
- Health endpoint: `https://your-domain.com/api/chat/health`

## Useful Commands

```bash
# View real-time logs
docker compose logs -f

# Restart a service
docker compose restart backend

# Rebuild after code changes
docker compose up -d --build

# Stop everything
docker compose down

# Stop and delete volumes (⚠️ deletes database)
docker compose down -v
```

## Architecture

```
                         ┌──────────────┐
                         │   Browser    │
                         └──────┬───────┘
                                │ HTTPS
                         ┌──────▼───────┐
                         │    Nginx     │  (port 443/80)
                         │ (frontend)   │
                         └──┬───────┬───┘
                            │       │
                    /api/*  │       │  /* (static files)
                            │       │
                         ┌──▼───────┴───┐
                         │   Angular    │
                         │  (SPA build) │
                         └──────────────┘
                         │
                         │ proxy_pass
                         │
                    ┌────▼──────────────┐
                    │  Spring Boot      │  (port 8080)
                    │  (backend)        │
                    │  H2 Database      │
                    └───────────────────┘
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `backend` container keeps restarting | Missing API key | Check `.env` has all required keys |
| Frontend shows "disconnected" | Backend not ready yet | Wait 30-40s for startup, check `docker compose logs backend` |
| 502 Bad Gateway | Backend not running | `docker compose ps` to check if backend is up |
| Domain not resolving | DNS not propagated | `dig your-domain.com` to check A record |
| Certbot fails | Port 80 not accessible | Check firewall: `sudo ufw status` |
