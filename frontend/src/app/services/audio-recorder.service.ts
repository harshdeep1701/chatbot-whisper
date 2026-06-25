import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingSubject = new Subject<{ type: 'data' | 'error' | 'complete'; data?: Blob; error?: string }>();

  recordingState$ = this.recordingSubject.asObservable();
  isRecording = false;

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.recordingSubject.next({ type: 'data' });
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.recordingSubject.next({ type: 'complete', data: audioBlob });
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.onerror = () => {
        this.recordingSubject.next({ type: 'error', error: 'Recording failed' });
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (err: any) {
      this.recordingSubject.next({ type: 'error', error: err.message || 'Microphone access denied' });
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}
