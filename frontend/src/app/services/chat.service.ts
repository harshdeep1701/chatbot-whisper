import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  reply: string;
  conversationId: string;
  success: boolean;
  error?: string;
}

export interface SttResponse {
  transcribedText: string;
  success: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  sendMessage(message: string, conversationId?: string, history?: ChatMessage[]): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiUrl}/chat`, {
      message,
      conversationId,
      history
    });
  }

  transcribeAudio(audioBlob: Blob): Observable<SttResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return this.http.post<SttResponse>(`${this.apiUrl}/speech/stt`, formData);
  }

  synthesizeSpeech(text: string): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/speech/tts`, { text }, {
      responseType: 'blob'
    });
  }

  checkHealth(): Observable<string> {
    return this.http.get(`${this.apiUrl}/chat/health`, { responseType: 'text' });
  }
}
