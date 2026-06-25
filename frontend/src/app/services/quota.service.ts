import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface QuotaInfo {
  userId: number;
  tier: string;
  remainingTokens: number;
  totalTokensUsed?: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuotaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Fetch the authenticated user's own quota.
   * User ID is extracted from the JWT on the backend — no parameter needed.
   */
  getQuota(): Observable<QuotaInfo> {
    return this.http.get<QuotaInfo>(`${this.apiUrl}/chat/quota`);
  }
}
