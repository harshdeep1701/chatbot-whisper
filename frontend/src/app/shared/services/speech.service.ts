import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SttResponse, TtsPlaybackEvent } from '../../core/models/speech.models';

export interface SpeechSettings {
  sttProvider: 'browser' | 'whisper';
  ttsProvider: 'browser' | 'server';
}

const SETTINGS_KEY = 'cosmo-chat-settings';

/**
 * Speech service — supports both browser-native Web Speech API and
 * server-side Whisper STT / TTS, chosen via localStorage settings.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  private readonly API = environment.apiUrl;

  // ── Volume level during playback ─────────────────────────
  private volumeSubject = new BehaviorSubject<number>(0);
  readonly volumeLevel$: Observable<number> = this.volumeSubject.asObservable();

  // ── TTS lifecycle events ─────────────────────────────────
  private ttsEventSubject = new Subject<TtsPlaybackEvent>();
  readonly ttsEvents$: Observable<TtsPlaybackEvent> = this.ttsEventSubject.asObservable();

  // ── Active playback references ───────────────────────────
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  // ── Browser TTS reference ────────────────────────────────
  private browserTtsUtterance: SpeechSynthesisUtterance | null = null;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
  ) {}

  // ── Settings ─────────────────────────────────────────────

  getSettings(): SpeechSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw) as SpeechSettings;
    } catch { /* ignore */ }
    return { sttProvider: 'whisper', ttsProvider: 'browser' };
  }

  isBrowserStt(): boolean {
    return this.getSettings().sttProvider === 'browser';
  }

  isBrowserTts(): boolean {
    return this.getSettings().ttsProvider === 'browser';
  }

  // ── STT ──────────────────────────────────────────────────

  /** Server-side Whisper STT */
  transcribe(audioBlob: Blob): Observable<SttResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return this.http.post<SttResponse>(`${this.API}/speech/stt`, formData);
  }

  /**
   * Browser-native SpeechRecognition STT.
   * Returns an Observable that emits the final transcript and completes.
   */
  transcribeBrowser(): Observable<SttResponse> {
    return new Observable<SttResponse>(subscriber => {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        subscriber.error(new Error('SpeechRecognition not supported'));
        return;
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.ngZone.run(() => {
          subscriber.next({ transcribedText: transcript, success: true });
          subscriber.complete();
        });
      };

      rec.onerror = (event: any) => {
        this.ngZone.run(() => {
          if (event.error === 'no-speech' || event.error === 'aborted') {
            subscriber.next({ transcribedText: '', success: false, error: event.error });
            subscriber.complete();
          } else {
            subscriber.error(new Error(event.error));
          }
        });
      };

      rec.onend = () => {
        this.ngZone.run(() => {
          subscriber.next({ transcribedText: '', success: false, error: 'no-speech' });
          subscriber.complete();
        });
      };

      rec.start();

      return () => {
        try { rec.abort(); } catch { /* ignore */ }
      };
    });
  }

  // ── TTS ──────────────────────────────────────────────────

  /** Server-side TTS — returns raw audio bytes */
  synthesize(text: string): Observable<ArrayBuffer> {
    return this.http.post(
      `${this.API}/speech/tts`,
      { text },
      { responseType: 'arraybuffer' },
    );
  }

  /**
   * Browser-native SpeechSynthesis TTS.
   * Emits word-boundary pulses to volumeLevel$ and lifecycle events to ttsEvents$.
   * Calls onEnd when finished (unless cancelled).
   */
  synthesizeBrowser(text: string, onEnd?: () => void): void {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.1;
    utterance.pitch = 1;
    this.browserTtsUtterance = utterance;

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name === 'word') {
        this.volumeSubject.next(0.6 + Math.random() * 0.3);
      }
    };

    utterance.onstart = () => {
      this.ngZone.run(() => {
        this.ttsEventSubject.next({ type: 'started' });
      });
    };

    utterance.onend = () => {
      this.ngZone.run(() => {
        this.browserTtsUtterance = null;
        this.volumeSubject.next(0);
        this.ttsEventSubject.next({ type: 'ended' });
        if (onEnd) onEnd();
      });
    };

    utterance.onerror = () => { /* suppress */ };

    window.speechSynthesis.speak(utterance);
  }

  /** Decode server TTS audio and play via AudioBufferSourceNode */
  playTts(arrayBuffer: ArrayBuffer): Observable<TtsPlaybackEvent> {
    this.stopTts();
    this.stopBrowserTts();

    return new Observable<TtsPlaybackEvent>(subscriber => {
      this.ensureAudioContext()
        .then(ctx => ctx.decodeAudioData(arrayBuffer.slice(0)))
        .then(audioBuffer => {
          this.analyserNode = this.audioContext!.createAnalyser();
          this.analyserNode.fftSize = 256;
          this.analyserNode.smoothingTimeConstant = 0.8;

          this.sourceNode = this.audioContext!.createBufferSource();
          this.sourceNode.buffer = audioBuffer;
          this.sourceNode.connect(this.analyserNode);
          this.analyserNode.connect(this.audioContext!.destination);

          this.loopTtsVolume();

          this.sourceNode.onended = () => {
            this.ngZone.run(() => {
              this.stopTtsVolumeLoop();
              this.volumeSubject.next(0);
              const event: TtsPlaybackEvent = { type: 'ended' };
              subscriber.next(event);
              subscriber.complete();
              this.ttsEventSubject.next(event);
            });
          };

          this.sourceNode.start(0);

          const started: TtsPlaybackEvent = { type: 'started' };
          subscriber.next(started);
          this.ttsEventSubject.next(started);
        })
        .catch(err => subscriber.error(err));

      return () => { this.stopTts(); };
    });
  }

  /** Stop server-side TTS playback */
  stopTts(): void {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch { /* ignore */ }
      this.sourceNode = null;
    }
    this.stopTtsVolumeLoop();
    this.volumeSubject.next(0);
    const interrupted: TtsPlaybackEvent = { type: 'interrupted' };
    this.ttsEventSubject.next(interrupted);
  }

  /** Stop browser-native TTS */
  stopBrowserTts(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.browserTtsUtterance = null;
  }

  /** Stop all TTS (server + browser) */
  stopAllTts(): void {
    this.stopTts();
    this.stopBrowserTts();
  }

  // ── Volume helpers ───────────────────────────────────────

  private loopTtsVolume(): void {
    if (!this.analyserNode) return;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const tick = () => {
      this.analyserNode!.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const centered = dataArray[i] - 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      this.volumeSubject.next(Math.min(1, rms / 64));

      if (this.sourceNode) {
        this.animationFrameId = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  private stopTtsVolumeLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // ── AudioContext ─────────────────────────────────────────

  private async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }
}
