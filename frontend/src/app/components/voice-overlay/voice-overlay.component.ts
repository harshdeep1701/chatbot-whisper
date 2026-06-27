import { Component, Output, EventEmitter, OnDestroy, AfterViewInit } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { SpeechService } from '../../services/speech.service';
import { AudioRecorderService } from '../../services/audio-recorder.service';
import { VoiceStateService, VoiceState } from '../../services/voice-state.service';
import { Subscription, finalize } from 'rxjs';

export type OverlayState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'interrupted' | 'done' | 'error';

@Component({
  selector: 'app-voice-overlay',
  templateUrl: './voice-overlay.component.html',
  styleUrls: ['./voice-overlay.component.scss']
})
export class VoiceOverlayComponent implements AfterViewInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() messageUser = new EventEmitter<string>();
  @Output() messageAssistant = new EventEmitter<string>();

  state: OverlayState = 'idle';
  errorMessage = '';
  transcriptText = '';
  responseText = '';

  /** Volume level 0–1 from the service (drives the sphere) */
  volumeLevel = 0;

  /** Expose VoiceState enum for template */
  readonly VoiceState = VoiceState;

  private subs: Subscription[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private stream: MediaStream | null = null;
  private serverAudio: HTMLAudioElement | null = null;
  private conversationId = '';
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  /** TTS word-timing simulation state */
  private ttsVolumeInterval: ReturnType<typeof setInterval> | null = null;

  /** Barge-in: debounce timer to discard TTS bleed-through */
  private bargeInDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isInBargeInWindow = false;

  /** Separate recognition instance for barge-in during TTS */
  private bargeInRecognition: any = null;

  constructor(
    private chatService: ChatService,
    private speechService: SpeechService,
    private audioRecorderService: AudioRecorderService,
    public voiceStateService: VoiceStateService
  ) {}

  ngAfterViewInit(): void {
    // Subscribe to volume level from the service
    this.subs.push(
      this.voiceStateService.volumeLevel$.subscribe(v => {
        this.volumeLevel = v;
      })
    );
    // Subscribe to TTS boundary events for volume simulation
    this.subs.push(
      this.speechService.ttsBoundary$.subscribe(() => {
        // Each word boundary → short volume pulse for the sphere
        this.voiceStateService.setVolume(0.7 + Math.random() * 0.3);
      })
    );
    // Auto-start listening when overlay opens
    setTimeout(() => this.startListening(), 600);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  onBackdropClick(): void {
    this.closeOverlay();
  }

  closeOverlay(): void {
    // Set state first so onend callback won't restart recognition
    this.state = 'idle';
    this.voiceStateService.reset();
    this.stopListening();
    this.stopSpeaking();
    this.cleanupAudio();
    this.close.emit();
  }

  // ── Voice Input ──────────────────────────────────────────

  startListening(): void {
    this.setState('listening');
    this.transcriptText = '';
    this.errorMessage = '';

    // Always reset before starting
    this.recognition = null;
    this.ensureRecognition();

    if (!this.recognition) {
      this.errorMessage = 'Speech recognition not supported in this browser.';
      this.setState('error');
      return;
    }

    try {
      this.recognition.start();
      this.startLoudnessDetection();
      this.resetSilenceTimer();
    } catch {
      // Fallback: use Whisper STT via audio recorder
      this.startWhisperRecording();
    }
  }

  // ── Browser Native STT ───────────────────────────────────

  private recognition: any = null;

  private ensureRecognition(): void {
    if (this.recognition) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      // ── FEATURE 1: Barge-In Interruption ──────────────
      // If TTS is playing and the user speaks, interrupt
      if (this.state === 'speaking' || this.state === 'interrupted') {
        this.handleBargeIn(event);
        return;
      }

      // ── Normal processing ─────────────────────────────
      // During barge-in debounce window (300ms), discard partial
      // results to avoid TTS audio bleed-through
      if (this.isInBargeInWindow) {
        // Only accumulate final results during the debounce window
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        if (final) {
          this.isInBargeInWindow = false;
          if (this.bargeInDebounceTimer) {
            clearTimeout(this.bargeInDebounceTimer);
            this.bargeInDebounceTimer = null;
          }
          this.transcriptText = this.transcriptText
            ? this.transcriptText + ' ' + final
            : final;
        }
        // Discard interim results during debounce window
        this.resetSilenceTimer();
        return;
      }

      // Accumulate all final results
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        }
      }
      if (final) {
        this.transcriptText = this.transcriptText
          ? this.transcriptText + ' ' + final
          : final;
      }
      // Reset silence timer on each speech result
      this.resetSilenceTimer();
    };

    this.recognition.onend = () => {
      // continuous=true can end unexpectedly (e.g. mic interruption).
      // Restart with a short cooldown to avoid tight infinite loops
      // if the browser fires onend immediately after every start().
      if (this.state === 'listening' && !this.transcriptText) {
        this.recognition = null;
        setTimeout(() => {
          if (this.state === 'listening' && !this.transcriptText) {
            this.startListening();
          }
        }, 300);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (this.state === 'listening') {
          this.recognition = null;
          setTimeout(() => {
            if (this.state === 'listening') {
              this.startListening();
            }
          }, 300);
        }
        return;
      }
      this.errorMessage = `Microphone error: ${event.error}`;
      this.setState('error');
    };
  }

  /**
   * FEATURE 1 — Barge-In Interruption
   * When the user starts speaking while TTS is playing:
   * 1. Cancel TTS playback
   * 2. Abort current STT, restart it fresh
   * 3. Set interrupted flag and state
   * 4. Apply 300ms debounce to discard TTS bleed-through
   */
  private handleBargeIn(event: any): void {
    // Only trigger barge-in once per interruption cycle
    if (this.voiceStateService.isInterrupted) return;

    // Stop TTS
    this.stopSpeaking();

    // Set interrupted state
    this.voiceStateService.setInterrupted(true);
    this.setState('interrupted');

    // Restart STT recognition to capture fresh utterance
    try { this.recognition?.abort?.(); } catch { /* ignore */ }
    this.recognition = null;
    this.stopBargeInDetection();

    // Enter barge-in debounce window (discard partial results for 300ms)
    this.isInBargeInWindow = true;
    this.transcriptText = '';
    this.responseText = '';

    // Restart listening after a short reset
    setTimeout(() => {
      this.voiceStateService.setInterrupted(false);
      this.isInBargeInWindow = false;
      this.startListening();
    }, 100);

    // Clear debounce flag after 300ms
    this.bargeInDebounceTimer = setTimeout(() => {
      this.isInBargeInWindow = false;
    }, 300);
  }

  // ── Whisper STT Fallback ─────────────────────────────────

  private startWhisperRecording(): void {
    this.audioRecorderService.startRecording();
    this.startLoudnessDetection();
    this.resetSilenceTimer();

    const sub = this.audioRecorderService.recordingState$.subscribe(event => {
      if (event.type === 'complete' && event.data) {
        this.clearSilenceTimer();
        this.setState('transcribing');
        this.chatService.transcribeAudio(event.data)
          .pipe(finalize(() => this.stopLoudnessDetection()))
          .subscribe({
            next: (res) => {
              if (res.success && res.transcribedText) {
                this.transcriptText = res.transcribedText;
                this.processTranscript(res.transcribedText);
              } else {
                this.errorMessage = res.error || 'Transcription failed';
                this.setState('error');
              }
            },
            error: () => {
              this.errorMessage = 'Transcription failed. Please try again.';
              this.setState('error');
            }
          });
      }
      if (event.type === 'error') {
        this.errorMessage = 'Recording failed. Please try again.';
        this.setState('error');
      }
    });
    this.subs.push(sub);
  }

  // ── Process Transcript → Chat API → Response ────────────

  private processTranscript(text: string): void {
    this.stopListening();
    this.clearSilenceTimer();
    this.setState('thinking');

    // Emit user message to chat window
    this.messageUser.emit(text);

    // Auto-stop Whisper recording if it was active
    if (this.audioRecorderService.getIsRecording()) {
      this.audioRecorderService.stopRecording();
    }

    this.chatService.sendMessage(text, this.conversationId, []).subscribe({
      next: (response) => {
        if (response.success) {
          this.conversationId = response.conversationId;
          this.responseText = response.reply;
          this.messageAssistant.emit(response.reply);
          this.speakResponse(response.reply);
        } else {
          this.errorMessage = response.error || 'Failed to get response';
          this.setState('error');
        }
      },
      error: () => {
        this.errorMessage = 'Connection error. Make sure the backend is running.';
        this.setState('error');
      }
    });
  }

  // ── Text-to-Speech Output ────────────────────────────────

  private speakResponse(text: string): void {
    this.setState('speaking');
    this.voiceStateService.setInterrupted(false);

    // Start TTS volume simulation (word-boundary pulses or idle decay)
    this.startTtsVolumeSimulation();

    // Start a separate mic session to detect barge-in during TTS
    this.startBargeInDetection();

    const useServerTts = this.loadTtsPreference();

    if (useServerTts) {
      this.chatService.synthesizeSpeech(text).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          this.serverAudio = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            this.serverAudio = null;
            this.stopTtsVolumeSimulation();
            this.stopBargeInDetection();
            this.voiceStateService.setVolume(0);
            this.continueListening();
          };
          audio.play().catch(() => this.fallbackBrowserTts(text));
        },
        error: () => this.fallbackBrowserTts(text)
      });
    } else {
      this.speechService.speak(text, () => {
        this.stopTtsVolumeSimulation();
        this.stopBargeInDetection();
        this.voiceStateService.setVolume(0);
        this.continueListening();
      });
    }
  }

  private fallbackBrowserTts(text: string): void {
    this.speechService.speak(text, () => {
      this.stopTtsVolumeSimulation();
      this.stopBargeInDetection();
      this.voiceStateService.setVolume(0);
      this.continueListening();
    });
  }

  /** After TTS finishes, loop back to listening for next question */
  private continueListening(): void {
    this.transcriptText = '';
    this.responseText = '';
    this.startListening();
  }

  private loadTtsPreference(): boolean {
    try {
      const saved = localStorage.getItem('cosmo-chat-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        return settings.ttsProvider === 'server';
      }
    } catch { /* ignore */ }
    return false;
  }

  private stopSpeaking(): void {
    this.speechService.stopSpeaking();
    if (this.serverAudio) {
      this.serverAudio.pause();
      this.serverAudio = null;
    }
    this.stopTtsVolumeSimulation();
    this.stopBargeInDetection();
  }

  /**
   * FEATURE 2 — TTS Volume Simulation
   * When using Web Speech API (no raw audio access), simulate volume
   * pulses via word-boundary events.  Between words, gently decay
   * the volume to keep the sphere animated.
   */
  private startTtsVolumeSimulation(): void {
    // Initial pulse
    this.voiceStateService.setVolume(0.5);

    // Fallback: gentle oscillation so the sphere never goes dark
    // during SpeechSynthesis playback (boundary events provide the peaks)
    this.ttsVolumeInterval = setInterval(() => {
      const current = this.voiceStateService.volumeLevel;
      if (current < 0.15) {
        // Gentle idle pulse to keep sphere visible
        this.voiceStateService.setVolume(0.2 + Math.random() * 0.15);
      } else {
        // Decay toward baseline
        this.voiceStateService.setVolume(Math.max(0.1, current * 0.92));
      }
    }, 120);
  }

  private stopTtsVolumeSimulation(): void {
    if (this.ttsVolumeInterval) {
      clearInterval(this.ttsVolumeInterval);
      this.ttsVolumeInterval = null;
    }
  }

  // ── FEATURE 2: Persistent Volume Detection ───────────────

  private async startLoudnessDetection(): Promise<void> {
    try {
      // Only create fresh stream if we don't already have one
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        // Resume if autoplay policy suspended it
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        source.connect(this.analyser);
      }
      this.loopLoudness();
    } catch {
      // Microphone not available — sphere stays idle
    }
  }

  private loopLoudness(): void {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const tick = () => {
      // Use RMS from time-domain data for a smoother level
      this.analyser!.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const centered = dataArray[i] - 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      // Normalize: silence ≈ 0, loud ≈ 1 (128 is max centered value)
      const normalized = Math.min(1, rms / 64);

      // Update the shared service (template reads from volumeLevel)
      this.voiceStateService.setVolume(normalized);

      // Keep running while voice mode is active (state !== 'idle')
      if (this.state !== 'idle' && this.state !== 'done') {
        this.animationFrameId = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  /**
   * Start a lightweight SpeechRecognition session solely for barge-in.
   * This keeps the mic hot while TTS is playing so the user can
   * interrupt at any time.
   */
  private startBargeInDetection(): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.bargeInRecognition = new SpeechRecognition();
    this.bargeInRecognition.continuous = true;
    this.bargeInRecognition.interimResults = true;
    this.bargeInRecognition.lang = 'en-US';

    this.bargeInRecognition.onresult = (event: any) => {
      // Any speech detection while in SPEAKING state triggers barge-in
      if (this.state === 'speaking') {
        this.handleBargeIn(event);
      }
    };

    this.bargeInRecognition.onend = () => {
      // Auto-restart if we're still speaking (recognition may time out)
      if (this.state === 'speaking') {
        this.bargeInRecognition = null;
        this.startBargeInDetection();
      }
    };

    this.bargeInRecognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (this.state === 'speaking') {
          this.bargeInRecognition = null;
          this.startBargeInDetection();
        }
        return;
      }
    };

    try {
      this.bargeInRecognition.start();
    } catch {
      // Mic may be unavailable — barge-in degraded
      this.bargeInRecognition = null;
    }
  }

  private stopBargeInDetection(): void {
    if (this.bargeInRecognition) {
      try { this.bargeInRecognition.stop(); } catch { /* ignore */ }
      this.bargeInRecognition = null;
    }
  }

  private stopLoudnessDetection(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.analyser = null;
    this.voiceStateService.setVolume(0);
  }

  // ── Helpers ──────────────────────────────────────────────

  private static readonly SILENCE_TIMEOUT_MS = 1500;

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.transcriptText) {
        this.processTranscript(this.transcriptText);
      } else if (this.audioRecorderService.getIsRecording()) {
        this.audioRecorderService.stopRecording();
      } else if (this.state === 'listening') {
        // No transcript yet but still listening — restart the timer so
        // we don't just die silently. The recognition is still running.
        this.resetSilenceTimer();
      }
    }, VoiceOverlayComponent.SILENCE_TIMEOUT_MS);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private stopListening(): void {
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
      this.recognition = null;
    }
    if (this.audioRecorderService.getIsRecording()) {
      this.audioRecorderService.stopRecording();
    }
  }

  private cleanupAudio(): void {
    this.stopLoudnessDetection();
    this.stopSpeaking();
  }

  private cleanup(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.cleanupAudio();
  }

  /** Map local OverlayState → VoiceState enum and update both */
  private setState(s: OverlayState): void {
    this.state = s;
    switch (s) {
      case 'idle':
      case 'done':
        this.voiceStateService.setState(VoiceState.IDLE);
        break;
      case 'listening':
        this.voiceStateService.setState(VoiceState.LISTENING);
        break;
      case 'transcribing':
      case 'thinking':
        this.voiceStateService.setState(VoiceState.PROCESSING);
        break;
      case 'speaking':
        this.voiceStateService.setState(VoiceState.SPEAKING);
        break;
      case 'interrupted':
        this.voiceStateService.setState(VoiceState.INTERRUPTED);
        break;
      default:
        this.voiceStateService.setState(VoiceState.IDLE);
        break;
    }
  }
}
