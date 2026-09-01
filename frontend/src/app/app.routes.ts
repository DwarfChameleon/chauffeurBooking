import { Routes } from '@angular/router';
import { adminGuard, driverGuard, employerGuard, publicOnlyGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', canActivate: [publicOnlyGuard], loadComponent: () => import('./pages/home.page').then((m) => m.HomePage) },
  { path: 'login', canActivate: [publicOnlyGuard], loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage) },
  { path: 'register', canActivate: [publicOnlyGuard], loadComponent: () => import('./pages/register.page').then((m) => m.RegisterPage) },
  { path: 'book-driver', canActivate: [employerGuard], loadComponent: () => import('./pages/book-driver.page').then((m) => m.BookDriverPage) },
  { path: 'employer', redirectTo: 'employer/dashboard', pathMatch: 'full' },
  { path: 'employer/dashboard', canActivate: [employerGuard], loadComponent: () => import('./pages/employer-dashboard.page').then((m) => m.EmployerDashboardPage) },
  { path: 'employer/chauffeurs', canActivate: [employerGuard], loadComponent: () => import('./pages/employer-chauffeurs.page').then((m) => m.EmployerChauffeursPage) },
  { path: 'employer/profile', canActivate: [employerGuard], loadComponent: () => import('./pages/employer-profile.page').then((m) => m.EmployerProfilePage) },
  { path: 'employer/profile/edit', canActivate: [employerGuard], loadComponent: () => import('./pages/employer-profile.page').then((m) => m.EmployerProfilePage) },
  { path: 'employer/notifications', canActivate: [employerGuard], loadComponent: () => import('./pages/notifications.page').then((m) => m.NotificationsPage) },
  { path: 'driver', redirectTo: 'driver/dashboard', pathMatch: 'full' },
  { path: 'driver/dashboard', canActivate: [driverGuard], loadComponent: () => import('./pages/driver-dashboard.page').then((m) => m.DriverDashboardPage) },
  { path: 'driver/bookings', canActivate: [driverGuard], loadComponent: () => import('./pages/driver-bookings.page').then((m) => m.DriverBookingsPage) },
  { path: 'driver/earnings', canActivate: [driverGuard], loadComponent: () => import('./pages/driver-earnings.page').then((m) => m.DriverEarningsPage) },
  { path: 'driver/profile', canActivate: [driverGuard], loadComponent: () => import('./pages/driver-profile.page').then((m) => m.DriverProfilePage) },
  { path: 'driver/profile/edit', canActivate: [driverGuard], loadComponent: () => import('./pages/driver-profile.page').then((m) => m.DriverProfilePage) },
  { path: 'driver/notifications', canActivate: [driverGuard], loadComponent: () => import('./pages/notifications.page').then((m) => m.NotificationsPage) },
  { path: 'admin', redirectTo: 'admin/dashboard', pathMatch: 'full' },
  { path: 'admin/dashboard', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-dashboard.page').then((m) => m.AdminDashboardPage) },
  { path: 'admin/users', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-users.page').then((m) => m.AdminUsersPage) },
  { path: 'admin/employers', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-employers.page').then((m) => m.AdminEmployersPage) },
  { path: 'admin/drivers', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-drivers.page').then((m) => m.AdminDriversPage) },
  { path: 'admin/bookings', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-bookings.page').then((m) => m.AdminBookingsPage) },
  { path: 'admin/verification', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-verification.page').then((m) => m.AdminVerificationPage) },
  { path: 'admin/notifications', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-notifications.page').then((m) => m.AdminNotificationsPage) },
  { path: 'dashboard', redirectTo: 'employer/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
