import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, Subscription, finalize, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';

import { VoiceStateService } from './voice-state.service';
import { VoiceSphereComponent } from './voice-sphere/voice-sphere.component';
import { SpeechService } from '../../shared/services/speech.service';
import { AudioRecorderService } from '../../shared/services/audio-recorder.service';
import { ChatService } from '../../features/chat/chat.service';
import { VoiceState } from '../../core/models/speech.models';

@Component({
  selector: 'app-voice-shell',
  standalone: true,
  imports: [CommonModule, VoiceSphereComponent],
  templateUrl: './voice-shell.component.html',
  styleUrls: ['./voice-shell.component.scss'],
})
export class VoiceShellComponent implements OnInit, OnDestroy {
  @ViewChild('sphere') sphereRef!: ElementRef;

  // ── UI state ─────────────────────────────────────────────
  state: VoiceState = 'IDLE';
  transcript = '';
  response = '';
  errorMessage = '';

  // ── Timers ───────────────────────────────────────────────
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly SILENCE_MS = (environment as any).sttSilenceMs ?? 1500;
  private readonly MAX_DURATION_MS = (environment as any).sttMaxDurationMs ?? 8000;
  private readonly SILENCE_THRESHOLD = 0.015;

  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private conversationId = '';
  private destroy$ = new Subject<void>();

  private subs: Subscription[] = [];

  constructor(
    public voiceStateService: VoiceStateService,
    private speechService: SpeechService,
    private audioRecorderService: AudioRecorderService,
    private chatService: ChatService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Sync local state with the service
    this.voiceStateService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => (this.state = s));

    this.voiceStateService.volumeLevel$
      .pipe(takeUntil(this.destroy$))
      .subscribe();

    // Start the voice flow
    this.startVoiceSession();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subs.forEach(s => s.unsubscribe());
    this.cleanupAudio();
  }

  // ── Exit ─────────────────────────────────────────────────
  exit(): void {
    this.voiceStateService.reset();
    this.router.navigate(['/chat']);
  }

  // ── Voice flow ───────────────────────────────────────────
  startVoiceSession(): void {
    this.voiceStateService.setState('LISTENING');
    this.transcript = '';
    this.response = '';
    this.errorMessage = '';

    this.ensureMicStream().then(() => {
      this.startRecording();
    });
  }

  private async ensureMicStream(): Promise<void> {
    if (this.micStream) return;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      const source = this.audioContext.createMediaStreamSource(this.micStream);
      this.micAnalyser = this.audioContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micAnalyser.smoothingTimeConstant = 0.8;
      source.connect(this.micAnalyser);

      // Give the analyser to the state service for barge-in detection
      this.voiceStateService.setMicAnalyser(this.micAnalyser);
    } catch {
      this.errorMessage = 'Microphone access denied.';
      this.voiceStateService.setState('IDLE');
    }
  }

  private startRecording(): void {
    this.audioRecorderService.startRecording();

    // Max-duration safety net
    this.maxDurationTimer = setTimeout(() => {
      this.audioRecorderService.stopRecording();
    }, this.MAX_DURATION_MS);

    // Silence detection: check mic RMS every 150ms; stop if below threshold
    // for SILENCE_MS continuously.
    let silenceStart: number | null = null;
    const dataArray = new Uint8Array(this.micAnalyser!.frequencyBinCount);

    this.silenceCheckInterval = setInterval(() => {
      if (!this.micAnalyser || this.state !== 'LISTENING') return;

      this.micAnalyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const centered = dataArray[i] - 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length) / 128;

      if (rms < this.SILENCE_THRESHOLD) {
        if (silenceStart === null) silenceStart = Date.now();
        else if (Date.now() - silenceStart >= this.SILENCE_MS) {
          this.clearRecordingTimers();
          this.audioRecorderService.stopRecording();
        }
      } else {
        silenceStart = null; // reset — user is still speaking
      }
    }, 150);

    // Listen for recording completion
    const sub = this.audioRecorderService.recordingState$.subscribe(event => {
      if (event.type === 'complete' && event.data) {
        this.clearRecordingTimers();
        this.processStt(event.data);
      }
      if (event.type === 'error') {
        this.clearRecordingTimers();
        this.errorMessage = event.error || 'Recording failed';
        this.voiceStateService.setState('IDLE');
      }
    });
    this.subs.push(sub);
  }

  private clearRecordingTimers(): void {
    if (this.maxDurationTimer) { clearTimeout(this.maxDurationTimer); this.maxDurationTimer = null; }
    if (this.silenceCheckInterval) { clearInterval(this.silenceCheckInterval); this.silenceCheckInterval = null; }
  }

  private processStt(audioBlob: Blob): void {
    this.voiceStateService.setState('PROCESSING');

    this.speechService
      .transcribe(audioBlob)
      .subscribe({
        next: res => {
          if (res.success && res.transcribedText) {
            this.transcript = res.transcribedText;
            this.sendToChat(res.transcribedText);
          } else {
            this.errorMessage = res.error || 'Transcription failed';
            this.voiceStateService.setState('IDLE');
          }
        },
        error: () => {
          this.errorMessage = 'Transcription failed.';
          this.voiceStateService.setState('IDLE');
        },
      });
  }

  private sendToChat(text: string): void {
    this.chatService.sendMessage(text, this.conversationId).subscribe({
      next: res => {
        if (res.success) {
          this.conversationId = res.conversationId;
          this.response = res.reply;
          this.speakResponse(res.reply);
        } else {
          this.errorMessage = res.error || 'Chat failed';
          this.voiceStateService.setState('IDLE');
        }
      },
      error: () => {
        this.errorMessage = 'Connection error.';
        this.voiceStateService.setState('IDLE');
      },
    });
  }

  private speakResponse(text: string): void {
    this.voiceStateService.setState('SPEAKING');

    if (this.speechService.isBrowserTts()) {
      // Browser-native TTS — no server round-trip
      this.speechService.synthesizeBrowser(text, () => {
        this.voiceStateService.setState('LISTENING');
        this.transcript = '';
        this.response = '';
        this.startRecording();
      });
      return;
    }

    // Server TTS
    this.speechService.synthesize(text).subscribe({
      next: buffer => {
        const sub = this.speechService.playTts(buffer).subscribe({
          next: event => {
            if (event.type === 'ended') {
              // Natural end → loop back to listening
              this.voiceStateService.setState('LISTENING');
              this.transcript = '';
              this.response = '';
              this.startRecording();
            }
            if (event.type === 'interrupted') {
              // Barge-in → VoiceStateService handles the transition
            }
          },
          error: () => {
            this.voiceStateService.setState('LISTENING');
            this.startRecording();
          },
        });
        this.subs.push(sub);
      },
      error: () => {
        this.voiceStateService.setState('LISTENING');
        this.startRecording();
      },
    });
  }

  // ── Cleanup ──────────────────────────────────────────────
  private cleanupAudio(): void {
    this.clearRecordingTimers();
    this.speechService.stopAllTts();
    this.voiceStateService.setMicAnalyser(null);
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
