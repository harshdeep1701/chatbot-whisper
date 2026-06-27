# Cosmo-Chat 🤖🎤

A voice-enabled AI chatbot with **Speech-to-Text (STT)** and **Text-to-Speech (TTS)** capabilities. Built with **Angular 18** (frontend) and **Spring Boot 3** (backend).

## ✨ Features

- 💬 **AI Chat** — Powered by DeepSeek, OpenAI, or Google Gemini
- 🎤 **Voice Input** — Record via browser microphone (browser-native STT or OpenAI Whisper)
- 🔊 **Text-to-Speech** — Hear responses read aloud (browser-native or server-side TTS)
- 🔐 **Authentication** — JWT-based login/register with User and Admin roles
- 📊 **Token Quota** — Daily usage tracking with a visual ring chart
- ⚙️ **Configurable** — Choose between browser-native or server-based speech processing
- 🎨 **Dark Purple Theme** — Cohesive dark UI across all screens
- 📱 **Responsive** — Works on desktop and mobile with slide-out sidebar

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 18, SCSS, Marked |
| **Backend** | Spring Boot 3.2.5 (Java 17) |
| **Database** | H2 (file-based, no external DB) |
| **AI Models** | DeepSeek, OpenAI, Google Gemini (via LangChain4j) |
| **Auth** | JWT (jjwt 0.12.5) |
| **Infrastructure** | Docker, Docker Compose, Nginx |

## 🚀 Quick Start (Development)

### Backend

```bash
cd backend
# Set your API keys as environment variables:
#   DEEPSEEK_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
mvn spring-boot:run
```
The API starts at `http://localhost:8080`.

### Frontend

```bash
cd frontend
npm install
ng serve
```
The UI opens at `http://localhost:4200`.

## 🐳 Docker Deployment

See [DEPLOY.md](./DEPLOY.md) for full VPS deployment instructions.

```bash
docker compose up -d --build
```

## 🔧 Environment Variables

| Variable | Description |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `OPENAI_API_KEY` | OpenAI API key (Whisper STT) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `JWT_SECRET` | JWT signing secret (256-bit minimum) |
| `DOMAIN_NAME` | Deployment domain (e.g. `harshdeep.tech`) |

## 📁 Project Structure

```
chatbot-whisper/
├── backend/
│   └── src/main/java/com/chatbot/
│       ├── config/          # JWT filter, Security, Web, CORS
│       ├── controller/      # ChatController, SpeechController, AuthController
│       ├── model/           # Entities (User, ChatMessage) & DTOs
│       ├── repository/      # JPA repositories
│       └── service/         # ChatService, SpeechService, QuotaService
├── frontend/
│   └── src/app/
│       ├── core/            # Auth service, guards, interceptors
│       ├── features/        # Chat, Auth (login/register), Admin (lazy-loaded)
│       └── shared/          # Speech service, audio recorder, quota ring, directives
├── docker-compose.yml
├── DEPLOY.md
└── README.md
```

## 🔐 Authentication

- **JWT-based** — Token returned on login/register, attached as `Authorization: Bearer` header
- **Token expiry** — 24 hours (configurable via `jwt.expiration`)
- **Roles** — `USER` (default) and `ADMIN` (first registered user)
- **Guards** — `authGuard` protects chat routes; `adminGuard` protects admin panel
- **On expiry** — Token checked on page load; expired tokens trigger automatic logout

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | User login |
| POST | `/api/auth/register` | No | User registration |
| POST | `/api/chat` | Yes | Send chat message |
| GET | `/api/chat/health` | No | Health check |
| GET | `/api/chat/quota` | Yes | Token quota info |
| POST | `/api/speech/stt` | Yes | Transcribe audio (Whisper) |
| POST | `/api/speech/tts` | Yes | Synthesize speech |
| GET | `/api/admin/users` | Admin | List all users |
| GET | `/api/admin/quota` | Admin | All users' quota |

## 📄 License

MIT

│           ├── speech.service.ts
│           └── audio-recorder.service.ts
└── README.md
```
