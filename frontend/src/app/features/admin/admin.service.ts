import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  tier: string;
  totalTokensUsed: number;
  remainingTokens: number;
  premiumSince: string | null;
  createdAt: string;
}

export interface AdminUsersResponse {
  success: boolean;
  count: number;
  users: AdminUser[];
  error?: string;
}

export interface AdminActionResponse {
  success: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** GET /api/admin/users */
  listUsers(): Observable<AdminUsersResponse> {
    return this.http.get<AdminUsersResponse>(`${this.API}/admin/users`);
  }

  /** POST /api/admin/users/{id}/premium */
  upgradeToPremium(userId: number): Observable<AdminActionResponse> {
    return this.http.post<AdminActionResponse>(
      `${this.API}/admin/users/${userId}/premium`,
      {},
    );
  }

  /** POST /api/admin/users/{id}/free */
  downgradeToFree(userId: number): Observable<AdminActionResponse> {
    return this.http.post<AdminActionResponse>(
      `${this.API}/admin/users/${userId}/free`,
      {},
    );
  }

  /** POST /api/admin/users/{id}/make-admin */
  makeAdmin(userId: number): Observable<AdminActionResponse> {
    return this.http.post<AdminActionResponse>(
      `${this.API}/admin/users/${userId}/make-admin`,
      {},
    );
  }

  /** POST /api/admin/users/{id}/remove-admin */
  removeAdmin(userId: number): Observable<AdminActionResponse> {
    return this.http.post<AdminActionResponse>(
      `${this.API}/admin/users/${userId}/remove-admin`,
      {},
    );
  }
}
