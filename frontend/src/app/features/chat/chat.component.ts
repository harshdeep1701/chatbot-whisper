import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ChatService } from './chat.service';
import { SpeechService, SpeechSettings } from '../../shared/services/speech.service';
import { AudioRecorderService } from '../../shared/services/audio-recorder.service';
import { QuotaService } from '../../shared/services/quota.service';
import { ChatMessage } from '../../core/models/chat.models';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { WaveformVisualizerComponent } from '../../shared/components/waveform-visualizer/waveform-visualizer.component';
import { QuotaRingComponent } from '../../shared/components/quota-ring/quota-ring.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe, WaveformVisualizerComponent, QuotaRingComponent],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // ── State ────────────────────────────────────────────────
  messages: ChatMessage[] = [];
  userInput = '';
  isLoading = false;
  conversationId = '';

  /** True while TTS is speaking (via SpeechService) */
  isSpeaking = false;

  /** True while the browser mic is actively recording (Whisper) */
  isRecording = false;
  /** True while Whisper audio is being transcribed */
  isTranscribing = false;

  /** Voice overlay visibility — opens the fullscreen /voice route */
  voiceOverlayVisible = false;

  /** Index of the most recent message for entrance animation */
  enteringMessageIndex = -1;

  /** AnalyserNode for recording waveform visualisation */
  analyserNode: AnalyserNode | null = null;

  private subs: Subscription[] = [];
  private audioContext: AudioContext | null = null;

  // ── Typing indicator ─────────────────────────────────────
  /** True to show the typing dots bubble */
  get isTyping(): boolean {
    return this.isLoading;
  }

  // ── Constructor ──────────────────────────────────────────
  constructor(
    private chatService: ChatService,
    private speechService: SpeechService,
    private audioRecorderService: AudioRecorderService,
    public quotaService: QuotaService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────
  ngOnInit(): void {
    // Welcome message
    this.messages.push({
      role: 'assistant',
      content:
        "Hello! I'm your voice-enabled AI assistant. I'm powered by advanced AI for intelligent conversations and speech recognition. How can I help you today?",
      timestamp: new Date(),
    });

    // Whisper recording completion → transcribe
    this.subs.push(
      this.audioRecorderService.recordingState$.subscribe(event => {
        if (event.type === 'complete' && event.data) {
          this.transcribeRecording(event.data);
        }
        if (event.type === 'error') {
          this.isRecording = false;
          this.isTranscribing = false;
          this.cleanupAnalyser();
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.audioRecorderService.getIsRecording()) {
      this.audioRecorderService.stopRecording();
    }
    this.speechService.stopAllTts();
    this.cleanupAnalyser();
  }

  // ── Send Message ─────────────────────────────────────────
  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', content: text, timestamp: new Date() });
    this.userInput = '';
    this.isLoading = true;
    this.scrollToBottom();
    this.animateLatestMessage();

    const history = this.messages.slice(0, -1);

    this.chatService
      .sendMessage(text, this.conversationId, history)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: res => {
          if (res.success) {
            this.conversationId = res.conversationId;
            this.messages.push({
              role: 'assistant',
              content: res.reply,
              timestamp: new Date(),
            });
            this.cdr.detectChanges();
            this.scrollToBottom();
            this.animateLatestMessage();
          } else {
            this.addSystemMessage(`Error: ${res.error || 'Unknown error'}`);
          }
        },
        error: err => {
          this.addSystemMessage(
            `Connection error: ${err.message}. Make sure the backend is running.`,
          );
        },
      });
  }

  // ── Voice Record (browser-native or Whisper) ──────────────
  toggleVoiceRecord(): void {
    if (this.isTranscribing) return;

    if (this.speechService.isBrowserStt()) {
      // Browser-native STT: one-shot recognition
      if (this.isRecording) return;
      this.isRecording = true;
      this.cdr.detectChanges();

      this.speechService.transcribeBrowser().subscribe({
        next: res => {
          this.isRecording = false;
          this.cleanupAnalyser();
          if (res.success && res.transcribedText) {
            this.userInput = res.transcribedText;
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.isRecording = false;
          this.cleanupAnalyser();
          this.cdr.detectChanges();
        },
      });
      this.setupRecordingAnalyser();
      return;
    }

    // Whisper STT: toggle recording
    if (this.audioRecorderService.getIsRecording()) {
      this.audioRecorderService.stopRecording();
      this.isRecording = false;
      this.cleanupAnalyser();
    } else {
      if (this.isSpeaking) this.speechService.stopAllTts();
      this.audioRecorderService.startRecording();
      this.isRecording = true;
      this.setupRecordingAnalyser();
    }
  }

  private transcribeRecording(audioBlob: Blob): void {
    this.isRecording = false;
    this.isTranscribing = true;
    this.cleanupAnalyser();
    this.cdr.detectChanges();

    this.speechService
      .transcribe(audioBlob)
      .pipe(finalize(() => {
        this.isTranscribing = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: res => {
          if (res.success && res.transcribedText) {
            this.userInput = res.transcribedText;
          } else {
            this.addSystemMessage(
              `Transcription failed: ${res.error || 'Unknown error'}`,
            );
          }
        },
        error: err => {
          this.addSystemMessage(`Transcription error: ${err.message}`);
        },
      });
  }

  // ── TTS (Read Aloud) — browser or server ──────────────────
  readAloud(content: string): void {
    if (this.isSpeaking) {
      this.speechService.stopAllTts();
      this.isSpeaking = false;
      return;
    }

    this.isSpeaking = true;

    if (this.speechService.isBrowserTts()) {
      // Browser-native TTS — no server round-trip
      this.speechService.synthesizeBrowser(content, () => {
        this.isSpeaking = false;
        this.cdr.detectChanges();
      });
      return;
    }

    // Server TTS
    this.speechService.synthesize(content).subscribe({
      next: buffer => {
        const sub = this.speechService.playTts(buffer).subscribe({
          next: event => {
            if (event.type === 'ended' || event.type === 'interrupted') {
              this.isSpeaking = false;
            }
          },
          error: () => (this.isSpeaking = false),
        });
        this.subs.push(sub);
      },
      error: () => (this.isSpeaking = false),
    });
  }

  // ── Settings ─────────────────────────────────────────────
  getSettings(): SpeechSettings {
    return this.speechService.getSettings();
  }

  setSttProvider(provider: 'browser' | 'whisper'): void {
    const s = this.getSettings();
    s.sttProvider = provider;
    localStorage.setItem('cosmo-chat-settings', JSON.stringify(s));
  }

  setTtsProvider(provider: 'browser' | 'server'): void {
    const s = this.getSettings();
    s.ttsProvider = provider;
    localStorage.setItem('cosmo-chat-settings', JSON.stringify(s));
  }

  // ── Voice-Only Mode ──────────────────────────────────────
  openVoiceMode(): void {
    this.router.navigate(['/voice']);
  }

  // ── Message animation ────────────────────────────────────
  private animateLatestMessage(): void {
    this.enteringMessageIndex = this.messages.length - 1;
    setTimeout(() => {
      this.enteringMessageIndex = -1;
      this.cdr.detectChanges();
    }, 250);
  }

  // ── Analyser for recording waveform ──────────────────────
  private setupRecordingAnalyser(): void {
    // Wait a tick for the stream to become available
    setTimeout(() => {
      const stream = this.audioRecorderService.getStream();
      if (!stream) return;
      try {
        if (!this.audioContext) {
          this.audioContext = new AudioContext();
        }
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        this.analyserNode = analyser;
        this.cdr.detectChanges();
      } catch {
        /* ignore */
      }
    }, 100);
  }

  private cleanupAnalyser(): void {
    this.analyserNode = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch { /* ignore */ }
    }
    this.audioContext = null;
  }

  // ── Helpers ──────────────────────────────────────────────
  private addSystemMessage(content: string): void {
    this.messages.push({ role: 'system', content, timestamp: new Date() });
    this.scrollToBottom();
    this.animateLatestMessage();
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      try {
        this.messagesContainer?.nativeElement?.scrollTo({
          top: this.messagesContainer.nativeElement.scrollHeight,
          behavior: 'smooth',
        });
      } catch {
        /* ignore */
      }
    });
  }
}
