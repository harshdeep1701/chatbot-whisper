# Chatbot Whisper — VPS Deployment Guide

Deploys alongside [harshdeep.tech](https://harshdeep.tech) at `harshdeep.tech/chat-bot`.

---

## Prerequisites

- Same Ubuntu VPS running harshdeep-tech (nginx + certbot already set up)
- Docker & Docker Compose installed
- Git access to the private repo

## 1. Clone and Configure

```bash
cd /var/www
git clone https://YOUR_TOKEN@github.com/harshdeep1701/chatbot-whisper.git
cd chatbot-whisper

# Create .env from example, or create it directly
cat > .env << 'EOF'
DEEPSEEK_API_KEY=sk-your-key
OPENAI_API_KEY=sk-your-key
GEMINI_API_KEY=your-key
JWT_SECRET=$(openssl rand -base64 32)
DOMAIN_NAME=harshdeep.tech
EOF

# Edit .env with real keys
nano .env
```

## 2. Start the Application

```bash
docker compose up -d --build
```

| Service | Container | Host Port (localhost only) |
|---|---|---|
| Backend (Spring Boot) | `cosmo-chat-backend` | `127.0.0.1:8081` |
| Frontend (Angular) | `cosmo-chat-frontend` | `127.0.0.1:4200` |

Ports are bound to `127.0.0.1` only — not exposed to the internet. The VPS nginx proxies requests.

## 3. Update VPS Nginx

The harshdeep-tech nginx config already includes proxy rules for `/chat-bot/` and `/api/`. If you need to update it manually:

```bash
sudo nano /etc/nginx/sites-available/harshdeep-tech
```

Ensure these blocks exist before the `location /` SPA fallback:

```nginx
location /chat-bot/ {
    rewrite ^/chat-bot/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:4200;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /chat-bot {
    return 301 /chat-bot/;
}

location /api/ {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Verify

- Visit `https://harshdeep.tech/chat-bot` — login page
- Health check: `https://harshdeep.tech/api/chat/health`

## Useful Commands

```bash
docker compose logs -f          # tail all logs
docker compose restart backend  # restart backend only
docker compose down             # stop all containers
docker compose up -d --build    # rebuild and restart
```

## Updating

```bash
cd /var/www/chatbot-whisper
git pull
docker compose up -d --build
sudo systemctl reload nginx   # only if nginx.conf changed
```

## HTTPS

No separate certbot setup needed — harshdeep.tech's existing HTTPS covers all subpaths.
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
