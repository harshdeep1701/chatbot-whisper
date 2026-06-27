// ── Speech Models ────────────────────────────────────────
// Request / response shapes for /api/speech/stt and /api/speech/tts

/** POST /api/speech/stt response */
export interface SttResponse {
  transcribedText: string;
  success: boolean;
  error?: string;
}

/** POST /api/speech/tts request body */
export interface TtsRequest {
  text: string;
}

/** Lifecycle events emitted during TTS playback */
export interface TtsPlaybackEvent {
  type: 'started' | 'ended' | 'interrupted';
}

/** Voice-only session state */
export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'INTERRUPTED';
