import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CareIntakeStore } from './care-intake.store';
import { DEMO_AUTH_DISABLED } from './demo-auth';

export const authGuard: CanActivateFn = () => {
  if (DEMO_AUTH_DISABLED) return true;
  const store = inject(CareIntakeStore);
  const router = inject(Router);
  return store.session() ? true : router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  if (DEMO_AUTH_DISABLED) return inject(Router).createUrlTree(['/dashboard']);
  const store = inject(CareIntakeStore);
  const router = inject(Router);
  return store.session() ? router.createUrlTree(['/dashboard']) : true;
};
