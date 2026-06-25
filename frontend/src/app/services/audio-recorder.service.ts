import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private recordingSubject = new Subject<{ type: 'data' | 'error' | 'complete'; data?: Blob; error?: string }>();

  recordingState$ = this.recordingSubject.asObservable();
  isRecording = false;

  /** Pick the best supported audio MIME type */
  private getPreferredMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', ''];
    for (const type of types) {
      if (!type || MediaRecorder.isTypeSupported(type)) return type || '';
    }
    return '';
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;
    this.isRecording = true; // Optimistic lock — prevents double-clicks

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      const mimeType = this.getPreferredMimeType();
      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);

      const contentType = this.mediaRecorder.mimeType || 'audio/webm';

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: contentType });
        this.recordingSubject.next({ type: 'complete', data: audioBlob });
        this.cleanup();
      };

      this.mediaRecorder.onerror = () => {
        this.recordingSubject.next({ type: 'error', error: 'Recording failed' });
        this.cleanup();
      };

      this.mediaRecorder.start();
    } catch (err: any) {
      this.isRecording = false;
      this.recordingSubject.next({ type: 'error', error: err.message || 'Microphone access denied' });
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false;
      try { this.mediaRecorder.stop(); } catch { /* already stopped */ }
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  private cleanup(): void {
    this.mediaRecorder = null;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}
