# ChatBot Whisper

A voice-enabled AI chatbot with **Speech-to-Text (STT)** and **Text-to-Speech (TTS)** capabilities.

- **LLM**: [DeepSeek](https://deepseek.com/) for intelligent conversations
- **STT**: [OpenAI Whisper](https://openai.com/research/whisper) for speech recognition (or browser native)
- **TTS**: OpenAI TTS or browser-native speech synthesis
- **Frontend**: Angular 18
- **Backend**: Java 17 + Spring Boot 3.2

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│                 │     │                  │     │                │
│   Angular App   │────▶│  Spring Boot API │────▶│   DeepSeek API │
│   (Frontend)    │     │  (Backend:8080)  │     │   (LLM Chat)   │
│                 │◀────│                  │◀────│                │
└─────────────────┘     └──────────────────┘     └────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│                 │     │                  │
│  Browser STT/TTS│     │  OpenAI Whisper  │
│  (Native APIs)  │     │  & TTS (Server)  │
│                 │     │                  │
└─────────────────┘     └──────────────────┘
```

## Features

- 💬 **Chat with DeepSeek** — Intelligent responses using DeepSeek's chat model
- 🎤 **Voice Input** — Hold-to-talk with speech recognition (browser native or Whisper)
- 🔊 **Text-to-Speech** — Listen to responses (browser native or OpenAI TTS)
- ⚙️ **Configurable** — Choose between browser-native or server-based speech processing
- 🎨 **Modern UI** — Clean, responsive interface with dark-friendly design

## Prerequisites

- **Node.js** 18+ and npm
- **Java 17+** and Maven (for backend)
- **Angular CLI** 18+ (`npm install -g @angular/cli`)
- API Keys:
  - [DeepSeek API Key](https://platform.deepseek.com/)
  - [OpenAI API Key](https://platform.openai.com/) (for Whisper STT & TTS)

## Setup & Running

### 1. Clone & Configure Backend

```bash
cd backend
```

Copy the environment template and add your API keys:

```bash
cp .env.example .env
# Edit .env and add your DEEPSEEK_API_KEY and OPENAI_API_KEY
```

**Option A:** Set environment variables directly:

```bash
# PowerShell
$env:DEEPSEEK_API_KEY="your-deepseek-key"
$env:OPENAI_API_KEY="your-openai-key"

# OR set them in your system environment variables
```

**Option B:** Use IntelliJ / VS Code run configuration to set env vars.

Build and run:

```bash
mvn clean package
mvn spring-boot:run
```

The backend starts at `http://localhost:8080`.

### 2. Run Frontend

```bash
cd frontend
npm install
ng serve
```

The frontend starts at `http://localhost:4200`.

### 3. Open the App

Navigate to **http://localhost:4200** and start chatting!

## Usage

### Text Chat
- Type a message and press Enter or click the send button
- The chatbot replies via DeepSeek API

### Voice Input (Browser Native)
- Hold the **microphone button** to start recording
- Release to stop — speech is transcribed in real-time using the browser's native Speech Recognition API
- Works offline (no server needed for recognition)

### Voice Input (Whisper STT)
- Open **Settings → Speech Recognition → Provider → OpenAI Whisper**
- Hold the microphone button to record audio
- Release — audio is sent to the backend, which transcribes it via OpenAI Whisper API

### Text-to-Speech
- By default, responses are spoken using the browser's native Speech Synthesis
- Open **Settings → Text-to-Speech → Provider → OpenAI TTS** for server-side TTS
- You can select from 6 different voices (Alloy, Echo, Fable, Onyx, Nova, Shimmer)

### Settings
Click the **Settings** button in the sidebar to:
- Check backend connection status
- Switch between browser-native and server-based STT/TTS
- Enable auto-speak for responses
- View model configuration

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send a chat message to DeepSeek |
| GET | `/api/chat/health` | Health check |
| POST | `/api/speech/stt` | Transcribe audio (Whisper) |
| POST | `/api/speech/tts` | Synthesize speech from text |

### Chat Request

```json
{
  "message": "Hello!",
  "conversationId": "optional-existing-conversation-id",
  "history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous reply" }
  ]
}
```

## Configuration

### Backend (`application.yml`)

| Property | Default | Description |
|----------|---------|-------------|
| `deepseek.api.key` | — | DeepSeek API key (required) |
| `deepseek.model` | `deepseek-chat` | DeepSeek model name |
| `openai.api.key` | — | OpenAI API key (required for Whisper/TTS) |
| `openai.whisper.model` | `whisper-1` | Whisper model |
| `openai.tts.model` | `tts-1` | TTS model |
| `openai.tts.voice` | `alloy` | TTS voice |

### Frontend (`src/environments/environment.ts`)

| Property | Default | Description |
|----------|---------|-------------|
| `apiUrl` | `http://localhost:8080/api` | Backend API URL |
| `enableVoice` | `true` | Enable voice features |

## Project Structure

```
chatbot-whisper/
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/chatbot/
│       ├── ChatbotApplication.java
│       ├── config/
│       │   ├── AppConfig.java
│       │   └── WebConfig.java
│       ├── controller/
│       │   ├── ChatController.java
│       │   └── SpeechController.java
│       ├── dto/
│       │   ├── ChatRequest.java
│       │   ├── ChatResponse.java
│       │   └── SttResponse.java
│       └── service/
│           ├── DeepSeekService.java
│           ├── TextToSpeechService.java
│           └── WhisperService.java
├── frontend/
│   ├── package.json
│   ├── angular.json
│   └── src/app/
│       ├── app.component.ts
│       ├── components/
│       │   ├── chat/          # Main chat interface
│       │   ├── voice-input/   # Voice recording button
│       │   └── settings/      # Configuration panel
│       └── services/
│           ├── chat.service.ts
│           ├── speech.service.ts
│           └── audio-recorder.service.ts
└── README.md
```
