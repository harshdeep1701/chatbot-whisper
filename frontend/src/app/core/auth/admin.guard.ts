import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Route guard — allows access only if the authenticated user has
 * the ADMIN role claim in their JWT.  Redirects to /unauthorized
 * or /login (if not authenticated at all).
 */
export const adminGuard: CanActivateFn = (): boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.parseUrl('/login') as unknown as boolean;
  }

  if (!authService.isAdmin()) {
    return router.parseUrl('/unauthorized') as unknown as boolean;
  }

  return true;
};
