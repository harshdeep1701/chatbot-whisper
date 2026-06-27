import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/services/toast.service';

/**
 * Global HTTP error interceptor.
 *
 * - 401 → clear token, navigate to /login
 * - 403 → navigate to /unauthorized
 * - 5xx → show toast notification
 *
 * AuthInterceptor (sibling) handles attaching the Bearer token.
 */
@Injectable()
export class ApiErrorInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
  ) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (!this.isApiCall(req.url)) {
          return throwError(() => error);
        }

        switch (error.status) {
          case 401:
            this.authService.logout();
            break;

          case 403:
            this.router.navigate(['/unauthorized']);
            break;

          case 0:
            // Network error / CORS / backend down
            this.toastService.show(
              'Unable to reach the server. Please check your connection.',
              'error',
            );
            break;

          default:
            if (error.status >= 500) {
              this.toastService.show(
                `Server error (${error.status}). Please try again later.`,
                'error',
              );
            }
            break;
        }

        return throwError(() => error);
      }),
    );
  }

  private isApiCall(url: string): boolean {
    return url.startsWith('http') && url.includes('/api/');
  }
}
