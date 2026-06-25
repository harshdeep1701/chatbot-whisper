import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface QuotaInfo {
  userId: number;
  tier: string;
  remainingTokens: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuotaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getQuota(userId: number): Observable<QuotaInfo> {
    return this.http.get<QuotaInfo>(`${this.apiUrl}/admin/quota/${userId}`);
  }
}
