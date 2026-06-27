import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserInfo,
  JwtPayload,
  UserRole,
} from '../models/auth.models';

/** Public API routes that do NOT require a JWT Bearer token */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/chat/health',
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiUrl; // e.g. http://localhost:8080/api
  private readonly TOKEN_KEY = 'chatbot_token';
  private readonly USER_KEY = 'chatbot_user';

  // ── In-memory JWT (primary) ─────────────────────────────
  private tokenSubject = new BehaviorSubject<string | null>(null);
  readonly token$: Observable<string | null> = this.tokenSubject.asObservable();

  // ── Current user ────────────────────────────────────────
  private userSubject = new BehaviorSubject<UserInfo | null>(null);
  readonly currentUser$: Observable<UserInfo | null> = this.userSubject.asObservable();

  // ── Derived role ────────────────────────────────────────
  readonly role$: Observable<UserRole | null> = this.currentUser$.pipe(
    map(user => user?.role ?? null),
  );

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this.loadUserFromStorage();
  }

  // ── Public API ──────────────────────────────────────────

  /** POST /api/auth/login */
  login(username: string, password: string): Observable<AuthResponse> {
    const body: LoginRequest = { username, password };
    return this.http
      .post<AuthResponse>(`${this.API}/auth/login`, body)
      .pipe(tap(res => { if (res.success) this.saveUser(res); }));
  }

  /** POST /api/auth/register */
  register(username: string, email: string, password: string): Observable<AuthResponse> {
    const body: RegisterRequest = { username, email, password };
    return this.http
      .post<AuthResponse>(`${this.API}/auth/register`, body)
      .pipe(tap(res => { if (res.success) this.saveUser(res); }));
  }

  /** Clear all auth state and redirect to login */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.tokenSubject.next(null);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  /** Synchronously returns the current token (null if logged out) */
  getToken(): string | null {
    return this.tokenSubject.value;
  }

  /** Synchronously returns whether a user is authenticated */
  isAuthenticated(): boolean {
    return this.userSubject.value !== null;
  }

  /** Synchronously checks ADMIN role */
  isAdmin(): boolean {
    return this.userSubject.value?.role === 'ADMIN';
  }

  /** Synchronously returns the current UserInfo snapshot */
  getCurrentUser(): UserInfo | null {
    return this.userSubject.value;
  }

  /**
   * Returns true if the given request URL targets a public API route
   * (one that does NOT need a JWT Bearer header).
   */
  isPublicApiUrl(url: string): boolean {
    return PUBLIC_ROUTES.some(route => url.includes(route));
  }

  // ── Internals ───────────────────────────────────────────

  private saveUser(response: AuthResponse): void {
    const role = this.decodeJwt(response.token).role;
    const user: UserInfo = {
      username: response.username,
      userId: response.userId,
      token: response.token,
      role,
    };

    // Persist to localStorage *only* for page-refresh survival
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));

    // Update in-memory subjects
    this.tokenSubject.next(response.token);
    this.userSubject.next(user);
  }

  private loadUserFromStorage(): void {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      const userRaw = localStorage.getItem(this.USER_KEY);
      if (!token || !userRaw) return;

      // Validate JWT hasn't expired
      const payload = this.decodeJwt(token);
      if (payload.exp * 1000 < Date.now()) {
        // Token expired — clear stale storage
        this.logout();
        return;
      }

      const user: UserInfo = JSON.parse(userRaw);
      this.tokenSubject.next(token);
      this.userSubject.next(user);
    } catch {
      // Corrupted storage — clean up
      this.logout();
    }
  }

  /**
   * Decode a JWT payload client-side without any library.
   * JWT format: header.payload.signature (Base64Url-encoded).
   */
  decodeJwt(token: string): JwtPayload {
    const payloadBase64 = token.split('.')[1];
    // Replace Base64Url chars → Base64 standard, then decode
    const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  }
}
