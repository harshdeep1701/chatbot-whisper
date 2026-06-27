import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatRequest, ChatResponse } from '../../core/models/chat.models';

/**
 * Chat service — typed wrapper around /api/chat and /api/chat/health.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** POST /api/chat */
  sendMessage(
    message: string,
    conversationId?: string,
    history?: ChatRequest['history'],
  ): Observable<ChatResponse> {
    const body: ChatRequest = { message, conversationId, history };
    return this.http.post<ChatResponse>(`${this.API}/chat`, body);
  }

  /** GET /api/chat/health */
  checkHealth(): Observable<string> {
    return this.http.get(`${this.API}/chat/health`, { responseType: 'text' });
  }
}
