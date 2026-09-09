import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminNavComponent } from '../admin-nav.component';
import { AdminBooking, AdminOverview } from '../admin-types';
import { WorkspaceHeaderComponent } from '../workspace-header.component';
import { RealtimeService } from '../../core/realtime.service';
import { RouteMapModalComponent } from '../../shared/route-map-modal.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent, RouteMapModalComponent],
  templateUrl: './admin-dashboard.page.html',
  styleUrl: './admin-dashboard.page.scss'
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  overview: AdminOverview | null = null;
  loading = false;
  error = '';
  selectedBooking: AdminBooking | null = null;
  selectedRouteBooking: AdminBooking | null = null;
  bookingModalOpen = false;
  routeModalOpen = false;
  private refreshId?: number;

  get notificationCount() { return (this.overview?.summary?.activeBookings || 0) + (this.overview?.summary?.pendingDocuments || 0); }

  async ngOnInit() {
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 10000);
  }

  ngOnDestroy() {
    if (this.refreshId) window.clearInterval(this.refreshId);
  }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      this.overview = await this.api.get<AdminOverview>('/admin/overview', token);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load admin dashboard';
    } finally {
      this.loading = false;
    }
  }

  async refresh(event: CustomEvent) { try { await this.load(false); } finally { await (event.target as any)?.complete(); } }
  go(path: string) { void this.router.navigateByUrl(path); }
  noticeIcon(type: string) { return type === 'booking' ? 'calendar-outline' : type === 'verification' ? 'shield-checkmark-outline' : 'speedometer-outline'; }
  openBooking(booking: AdminBooking) { this.selectedBooking = booking; this.bookingModalOpen = true; }
  closeBooking() { this.bookingModalOpen = false; this.selectedBooking = null; }
  openRoute(booking: AdminBooking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }
  displayDate(value?: string) { return value ? new Date(value).toLocaleString() : 'Pending'; }
  exactEventTime(value: string | undefined, fallback: string) { return value ? new Date(value).toLocaleString() : fallback; }
  relativeBookingTime(booking: AdminBooking) { return relativeTime(this.bookingActivityDate(booking)); }
  private bookingActivityDate(booking: AdminBooking) {
    return booking.completedAt || booking.arrivedAt || booking.startedAt || booking.acceptedAt || booking.updatedAt || booking.createdAt;
  }
}

function relativeTime(value?: string) {
  if (!value) return 'Just now';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Just now';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  const units: [number, string][] = [[2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'min']];
  for (const [unitSeconds, label] of units) {
    const count = Math.floor(seconds / unitSeconds);
    if (count >= 1) return `${count} ${label}${count === 1 ? '' : 's'} ago`;
  }
  return `${seconds} sec${seconds === 1 ? '' : 's'} ago`;
}
