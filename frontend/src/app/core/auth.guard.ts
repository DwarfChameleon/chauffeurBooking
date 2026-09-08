import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const publicOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = auth.session();
  return session ? router.parseUrl(auth.dashboardFor(session.user.role)) : true;
};

export const adminPublicOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = auth.session();
  return session?.user.role === 'admin' ? router.parseUrl('/admin/dashboard') : true;
};

export const signedInGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.session() ? true : router.parseUrl('/login');
};

export const employerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = auth.session();
  if (!session) return router.parseUrl('/login');
  return session.user.role === 'user' ? true : router.parseUrl(auth.dashboardFor(session.user.role));
};

export const driverGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = auth.session();
  if (!session) return router.parseUrl('/login');
  return session.user.role === 'driver' ? true : router.parseUrl(auth.dashboardFor(session.user.role));
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = auth.session();
  if (!session) return router.parseUrl('/admin/login');
  return session.user.role === 'admin' ? true : router.parseUrl(auth.dashboardFor(session.user.role));
};
