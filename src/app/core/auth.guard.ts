import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CareIntakeStore } from './care-intake.store';

export const authGuard: CanActivateFn = () => {
  const store = inject(CareIntakeStore);
  const router = inject(Router);
  return store.session() ? true : router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const store = inject(CareIntakeStore);
  const router = inject(Router);
  return store.session() ? router.createUrlTree(['/dashboard']) : true;
};
