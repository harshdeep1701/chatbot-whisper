import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  tier: string;
  totalTokensUsed: number;
  remainingToday: number;
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

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listUsers(): Observable<AdminUsersResponse> {
    return this.http.get<AdminUsersResponse>(`${this.apiUrl}/admin/users`);
  }

  upgradeToPremium(userId: number): Observable<AdminActionResponse> {
    return this.http.post<AdminActionResponse>(`${this.apiUrl}/admin/users/${userId}/premium`, {});
  }

  downgradeToFree(userId: number): Observable<AdminActionResponse> {
    return this.http.post<AdminActionResponse>(`${this.apiUrl}/admin/users/${userId}/free`, {});
  }

  makeAdmin(userId: number): Observable<AdminActionResponse> {
    return this.http.post<AdminActionResponse>(`${this.apiUrl}/admin/users/${userId}/make-admin`, {});
  }

  removeAdmin(userId: number): Observable<AdminActionResponse> {
    return this.http.post<AdminActionResponse>(`${this.apiUrl}/admin/users/${userId}/remove-admin`, {});
  }
}
