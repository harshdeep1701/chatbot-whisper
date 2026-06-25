import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SpeechEvent {
  type: 'interim' | 'final' | 'error' | 'end' | 'timeout-maxduration';
  text?: string;
  error?: string;
}

const MAX_DURATION_TIMEOUT_MS = 60000; // 1 minute max

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private recognition: any;
  private recognitionSubject = new Subject<SpeechEvent>();
  private isListening = false;

  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;

  // Speech recognition events
  speechEvents$ = this.recognitionSubject.asObservable();

  constructor() {}

  private ensureRecognition(): void {
    if (this.recognition) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        if (finalText) {
          this.recognitionSubject.next({ type: 'final', text: finalText });
        }
        if (interimText) {
          this.recognitionSubject.next({ type: 'interim', text: interimText });
        }
      };

      this.recognition.onerror = (event: any) => {
        this.clearTimers();
        this.recognitionSubject.next({ type: 'error', error: event.error });
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.clearTimers();
        this.isListening = false;
        this.recognitionSubject.next({ type: 'end' });
      };
    }
  }

  private startMaxDurationTimer(): void {
    this.maxDurationTimer = setTimeout(() => {
      this.recognitionSubject.next({ type: 'timeout-maxduration', text: 'Maximum recording time reached' });
      this.stopListening();
    }, MAX_DURATION_TIMEOUT_MS);
  }

  private clearTimers(): void {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }

  isSupported(): boolean {
    this.ensureRecognition();
    return this.recognition != null;
  }

  startListening(): void {
    this.ensureRecognition();
    if (!this.recognition || this.isListening) return;
    this.isListening = true;
    try {
      this.recognition.start();
      this.startMaxDurationTimer();
    } catch (e) {
      // Already started
    }
  }

  stopListening(): void {
    if (!this.recognition || !this.isListening) return;
    this.clearTimers();
    this.isListening = false;
    try {
      this.recognition.stop();
    } catch (e) {
      // Already stopped
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  // Text-to-Speech
  speak(text: string, onEnd?: () => void): void {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.1;
    utterance.pitch = 1;
    if (onEnd) {
      utterance.onend = onEnd;
    }
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
