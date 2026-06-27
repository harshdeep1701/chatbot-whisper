import { Component, OnInit, ViewChild, ElementRef, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { SpeechService } from '../../services/speech.service';
import { AudioRecorderService } from '../../services/audio-recorder.service';
import { AuthService } from '../../services/auth.service';
import { QuotaService } from '../../services/quota.service';
import { Subscription, finalize } from 'rxjs';

interface VoiceSettings {
  sttProvider?: 'browser' | 'whisper';
  ttsProvider?: 'browser' | 'server';
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  userInput = '';
  isLoading = false;
  conversationId = '';
  isSpeaking = false;
  useWhisperStt = false;
  useServerTts = false;
  readAloudEnabled = true;

  private subs: Subscription[] = [];
  private serverAudio: HTMLAudioElement | null = null;

  userId: number = 0;

  remainingTokens = -1;  // -1 = not yet loaded
  limitExceeded = false;

  /** True while the browser mic is actively listening */
  isListening = false;
  /** True while Whisper audio is being transcribed */
  isTranscribing = false;

  /** Voice overlay visibility */
  voiceOverlayVisible = false;


  constructor(
    public chatService: ChatService,
    public speechService: SpeechService,
    public audioRecorderService: AudioRecorderService,
    private quotaService: QuotaService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Load speech settings from localStorage
    this.loadSpeechSettings();

    // Get current user ID for quota
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userId = user.userId;
    }

    // Fetch initial quota
    if (this.userId > 0) {
      this.fetchQuota();
    }

    // Add welcome message
    this.messages.push({
      role: 'assistant',
      content: 'Hello! I\'m your voice-enabled AI assistant. I\'m powered by advanced AI for intelligent conversations and speech recognition. How can I help you today?',
      timestamp: new Date()
    });

    // Listen for speech recognition results
    this.subs.push(
      this.speechService.speechEvents$.subscribe(event => {
        if (event.type === 'final' && event.text) {
          this.isListening = false;
          this.userInput = event.text;
          this.sendMessage();
        }
        if (event.type === 'interim' && event.text) {
          // Show live interim transcript in the input field
          this.userInput = event.text;
        }
        if (event.type === 'end') {
          this.isListening = false;
        }
        if (event.type === 'error') {
          this.isListening = false;
          if (event.error === 'not-allowed') {
            this.addSystemMessage(
              '🎤 Microphone access was denied. Please allow microphone access in your browser settings and try again, or switch to Whisper STT in Settings.'
            );
          }
        }
        if (event.type === 'timeout-maxduration') {
          this.isListening = false;
        }
      })
    );

    // Listen for audio recording completion (for Whisper STT)
    this.subs.push(
      this.audioRecorderService.recordingState$.subscribe(event => {
        if (event.type === 'complete' && event.data) {
          this.processWhisperStt(event.data);
        }
        if (event.type === 'error' && event.error) {
          this.isTranscribing = false;
          this.addSystemMessage(`Recording error: ${event.error}`);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    // Stop any active recording
    if (this.audioRecorderService.getIsRecording()) {
      this.audioRecorderService.stopRecording();
    }
    // Stop any active speech recognition
    if (this.speechService.getIsListening()) {
      this.speechService.stopListening();
    }
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    // Block API call if daily quota is exhausted
    if (this.remainingTokens === 0) {
      this.limitExceeded = true;
      this.addSystemMessage(
        '⚠️ Daily token limit reached. Your quota resets at midnight UTC. ' +
        'Upgrade to premium for 1,000,000 tokens/day.'
      );
      this.userInput = '';
      return;
    }

    this.messages.push({ role: 'user', content: text, timestamp: new Date() });
    this.userInput = '';
    this.isLoading = true;
    this.scrollToBottom();

    const history = this.messages.slice(0, -1);
    this.chatService.sendMessage(text, this.conversationId, history)
      .pipe(finalize(() => {
        this.isLoading = false;
      }))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.conversationId = response.conversationId;
            this.messages.push({ role: 'assistant', content: response.reply, timestamp: new Date() });
            // Refresh quota after each successful message
            this.fetchQuota();
            // Force change detection so the message renders before TTS starts
            this.cdr.detectChanges();
            this.scrollToBottom();
            // Read aloud only if the toggle is enabled
            if (this.readAloudEnabled) {
              if (this.useServerTts) {
                this.speakViaServer(response.reply);
              } else {
                this.speakResponse(response.reply);
              }
            }
          } else {
            this.addSystemMessage(`Error: ${response.error || 'Unknown error'}`);
            this.scrollToBottom();
          }
        },
        error: (err) => {
          this.addSystemMessage(`Connection error: ${err.message}. Make sure the backend is running.`);
        }
      });
  }

  toggleVoiceInput(): void {
    if (this.isTranscribing) {
      return; // Don't toggle while transcribing
    }

    // Re-read latest STT setting from localStorage so changes apply immediately
    this.loadSpeechSettings();

    if (this.useWhisperStt) {
      // Whisper: click to start recording, click again to stop
      if (this.audioRecorderService.getIsRecording()) {
        this.audioRecorderService.stopRecording();
      } else {
        // Stop any ongoing TTS before recording
        if (this.isSpeaking) {
          this.stopSpeaking();
        }
        this.audioRecorderService.startRecording();
      }
    } else {
      // Browser STT: click toggles listening
      if (this.speechService.getIsListening()) {
        this.speechService.stopListening();
        this.isListening = false;
      } else {
        // Stop any ongoing TTS before listening
        if (this.isSpeaking) {
          this.stopSpeaking();
        }
        this.isListening = true;
        this.speechService.startListening();
      }
    }
  }

  private processWhisperStt(audioBlob: Blob): void {
    this.isTranscribing = true;
    // Force change detection — this callback may run outside Angular's zone
    // (MediaRecorder.onstop is a native DOM event)
    this.cdr.detectChanges();

    this.chatService.transcribeAudio(audioBlob)
      .pipe(finalize(() => {
        this.isTranscribing = false;
      }))
      .subscribe({
        next: (response) => {
          if (response.success && response.transcribedText) {
            this.userInput = response.transcribedText;
            this.sendMessage();
          } else {
            this.addSystemMessage(`Transcription failed: ${response.error || 'Unknown error'}`);
          }
        },
        error: (err) => {
          this.addSystemMessage(`Transcription error: ${err.message}`);
        }
      });
  }

  speakResponse(text: string): void {
    this.isSpeaking = true;
    this.speechService.speak(text, () => {
      this.isSpeaking = false;
    });
  }

  speakViaServer(text: string): void {
    this.isSpeaking = true;
    this.chatService.synthesizeSpeech(text).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        this.serverAudio = audio;
        audio.onended = () => {
          this.isSpeaking = false;
          this.serverAudio = null;
          URL.revokeObjectURL(url);
        };
        audio.play().catch(() => {
          this.isSpeaking = false;
          this.serverAudio = null;
        });
      },
      error: () => {
        this.isSpeaking = false;
        this.serverAudio = null;
      }
    });
  }

  toggleReadAloud(): void {
    this.readAloudEnabled = !this.readAloudEnabled;
    if (!this.readAloudEnabled) {
      this.stopSpeaking();
    }
  }

  stopSpeaking(): void {
    // Stop browser speech synthesis
    this.speechService.stopSpeaking();
    // Stop server-side audio playback
    if (this.serverAudio) {
      this.serverAudio.pause();
      this.serverAudio.currentTime = 0;
      this.serverAudio = null;
    }
    this.isSpeaking = false;
  }

  /** Load STT/TTS preferences from localStorage and auto-detect browser support */
  private loadSpeechSettings(): void {
    // Check if browser native speech recognition is supported
    const browserSttSupported = this.speechService.isSupported();

    try {
      const saved = localStorage.getItem('cosmo-chat-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        // STT provider
        if (settings.sttProvider === 'whisper') {
          this.useWhisperStt = true;
        } else if (settings.sttProvider === 'browser' && !browserSttSupported) {
          // Browser STT selected but unsupported — auto-fallback to Whisper
          this.useWhisperStt = true;
          console.warn('Browser speech recognition not supported — falling back to Whisper STT');
        } else {
          this.useWhisperStt = false;
        }
        // TTS provider
        if (settings.ttsProvider === 'server') {
          this.useServerTts = true;
        } else {
          this.useServerTts = false;
        }
      } else if (!browserSttSupported) {
        // No saved settings and browser STT unsupported — default to Whisper
        this.useWhisperStt = true;
      }
    } catch {
      // Ignore corrupt localStorage data
    }
  }

  private addSystemMessage(content: string): void {
    this.messages.push({ role: 'system', content, timestamp: new Date() });
    this.scrollToBottom();
  }

  private fetchQuota(): void {
    this.quotaService.getQuota().subscribe({
      next: (data) => {
        this.remainingTokens = data.remainingTokens;
        this.limitExceeded = this.remainingTokens <= 0;
      },
      error: () => { /* silently ignore */ }
    });
  }

  toggleVoiceOverlay(): void {
    this.voiceOverlayVisible = !this.voiceOverlayVisible;
  }

  onVoiceOverlayClosed(): void {
    this.voiceOverlayVisible = false;
    this.fetchQuota();
  }

  onVoiceOverlayUserMessage(text: string): void {
    this.messages.push({ role: 'user', content: text, timestamp: new Date() });
    this.scrollToBottom();
  }

  onVoiceOverlayAssistantMessage(text: string): void {
    this.messages.push({ role: 'assistant', content: text, timestamp: new Date() });
    this.scrollToBottom();
    // Update conversation ID from the last API call
    this.conversationId = ''; // will be set on next overlay interaction
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}
