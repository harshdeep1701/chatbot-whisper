import { Component, OnInit, ViewChild, ElementRef, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { SpeechService } from '../../services/speech.service';
import { AudioRecorderService } from '../../services/audio-recorder.service';
import { AuthService } from '../../services/auth.service';
import { Subscription, finalize } from 'rxjs';

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

  userId: number = 0;

  constructor(
    public chatService: ChatService,
    public speechService: SpeechService,
    public audioRecorderService: AudioRecorderService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get current user ID for quota
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userId = user.userId;
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
          this.userInput = event.text;
          this.sendMessage();
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
          this.addSystemMessage(`Recording error: ${event.error}`);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    this.messages.push({ role: 'user', content: text, timestamp: new Date() });
    this.userInput = '';
    this.isLoading = true;
    this.scrollToBottom();

    const history = this.messages.slice(0, -1);
    this.chatService.sendMessage(text, this.conversationId, history)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.conversationId = response.conversationId;
            this.messages.push({ role: 'assistant', content: response.reply, timestamp: new Date() });
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

  startVoiceInput(): void {
    if (this.useWhisperStt) {
      // Use Whisper API (record audio, then send to server)
      this.audioRecorderService.startRecording();
    } else {
      // Use browser native speech recognition
      this.speechService.startListening();
    }
  }

  stopVoiceInput(): void {
    if (this.useWhisperStt) {
      this.audioRecorderService.stopRecording();
    } else {
      this.speechService.stopListening();
    }
  }

  private async processWhisperStt(audioBlob: Blob): Promise<void> {
    this.isLoading = true;
    this.chatService.transcribeAudio(audioBlob)
      .pipe(finalize(() => this.isLoading = false))
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
        audio.onended = () => {
          this.isSpeaking = false;
          URL.revokeObjectURL(url);
        };
        audio.play().catch(() => {
          this.isSpeaking = false;
        });
      },
      error: () => {
        this.isSpeaking = false;
      }
    });
  }

  toggleReadAloud(): void {
    this.readAloudEnabled = !this.readAloudEnabled;
    if (!this.readAloudEnabled) {
      this.speechService.stopSpeaking();
      this.isSpeaking = false;
    }
  }

  stopSpeaking(): void {
    this.speechService.stopSpeaking();
    this.isSpeaking = false;
  }

  isMicActive(): boolean {
    return this.speechService.getIsListening() || this.audioRecorderService.getIsRecording();
  }

  private addSystemMessage(content: string): void {
    this.messages.push({ role: 'assistant', content, timestamp: new Date() });
    this.scrollToBottom();
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
