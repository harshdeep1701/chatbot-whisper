import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Route guard — allows access only if the user is authenticated.
 * Redirects to /login otherwise.
 */
export const authGuard: CanActivateFn = (): boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login') as unknown as boolean;
};
