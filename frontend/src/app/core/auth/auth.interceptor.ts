import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Attaches `Authorization: Bearer <token>` to every request whose URL
 * targets the backend API AND is not in the public-routes list
 * (login, register, health).
 *
 * 401/403/5xx handling is delegated to ApiErrorInterceptor.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();

    // Only attach token to backend API calls that need auth
    if (token && this.isApiCall(req.url) && !this.authService.isPublicApiUrl(req.url)) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }

    return next.handle(req);
  }

  /** Heuristic: does the URL target our backend API? */
  private isApiCall(url: string): boolean {
    return url.startsWith('http') && url.includes('/api/');
  }
}
