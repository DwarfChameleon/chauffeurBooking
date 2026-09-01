import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { IonBadge, IonButton, IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { RealtimeService } from '../core/realtime.service';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { RouteCoordinate } from '../shared/route-map.component';
import { RouteMapModalComponent } from '../shared/route-map-modal.component';

type BookingStatus = 'pending' | 'confirmed' | 'started' | 'arrived' | 'completed' | 'cancelled';
type Booking = { id: string; customerName: string; pickup: string; destination: string; notes?: string; time: string; amount: number | null; status: BookingStatus; routeUrl?: string; driverCoordinates?: RouteCoordinate; employerCoordinates?: RouteCoordinate; acceptedAt?: string; startedAt?: string; arrivedAt?: string; completedAt?: string; createdAt?: string; updatedAt?: string };

@Component({
  standalone: true,
  imports: [CommonModule, IonBadge, IonButton, IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent, WorkspaceHeaderComponent, RouteMapModalComponent],
  template: `
<div class="ion-page driver-page">
  <app-workspace-header role="driver" title="Bookings" (refreshRequested)="load()"></app-workspace-header>
  <ion-content class="driver-workspace">
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="workspace-shell">
      <section class="workspace-header page-intro"><div><p class="eyebrow">Driver Workspace</p><h1>Bookings</h1><p>Review assigned, upcoming, and completed driver work.</p></div></section>

      <section class="summary-grid">
        <article><span>Total</span><strong>{{ bookings.length }}</strong></article>
        <article><span>Pending</span><strong>{{ count('pending') }}</strong></article>
        <article><span>Accepted</span><strong>{{ count('confirmed') }}</strong></article>
        <article><span>Completed</span><strong>{{ count('completed') }}</strong></article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">ASSIGNMENTS</p>
            <h2>Booking List</h2>
          </div>
          <ion-badge>{{ bookings.length }}</ion-badge>
        </div>

        <p class="state" *ngIf="loading">Loading bookings...</p>
        <p class="state error" *ngIf="error">{{ error }}</p>
        <p class="state" *ngIf="!loading && !error && bookings.length === 0">No bookings assigned to this driver yet.</p>

        <article class="booking-row" *ngFor="let booking of bookings">
          <div class="booking-icon"><ion-icon name="car-outline"></ion-icon></div>
          <div>
            <h3>{{ booking.customerName }}</h3>
            <p>{{ booking.pickup }} -> {{ booking.destination }}</p>
            <small class="driver-note" *ngIf="booking.notes"><ion-icon name="chatbox-ellipses-outline"></ion-icon>{{ booking.notes }}</small>
            <span><ion-icon name="time-outline"></ion-icon>{{ relativeBookingTime(booking) }}</span>
          </div>
          <div class="booking-side">
            <strong class="status-pill" [ngClass]="booking.status">{{ booking.status | titlecase }}</strong>
            <div class="row-actions">
              <ion-button size="small" *ngIf="booking.status === 'pending'" (click)="acceptBooking(booking)">Accept</ion-button>
              <ion-button size="small" fill="outline" color="danger" *ngIf="booking.status === 'pending'" (click)="rejectBooking(booking)">Reject</ion-button>
              <ion-button size="small" fill="outline" *ngIf="booking.status === 'confirmed' || booking.status === 'started'" (click)="openRoute(booking)">Route</ion-button>
              <ion-button size="small" color="success" *ngIf="booking.status === 'confirmed'" (click)="startTrip(booking)">Start Trip</ion-button>
              <ion-button size="small" color="success" *ngIf="booking.status === 'started'" (click)="markArrived(booking)">Arrived</ion-button>
            </div>
          </div>
        </article>
      </section>
    </main>
  </ion-content>

  <ion-footer class="driver-bottom-nav">
    <div class="bottom-nav">
      <button class="nav-item" (click)="navigate('/driver/dashboard')"><ion-icon name="grid-outline"></ion-icon><span>Dashboard</span></button>
      <button class="nav-item active" (click)="navigate('/driver/bookings')"><ion-icon name="calendar-outline"></ion-icon><span>Bookings</span></button>
      <button class="nav-item availability-nav" (click)="navigate('/driver/dashboard')"><div><ion-icon name="power-outline"></ion-icon></div><span>Status</span></button>
      <button class="nav-item" (click)="navigate('/driver/earnings')"><ion-icon name="bar-chart-outline"></ion-icon><span>Earnings</span></button>
      <button class="nav-item" (click)="navigate('/driver/profile')"><ion-icon name="person-circle-outline"></ion-icon><span>Profile</span></button>
    </div>
  </ion-footer>
  <app-route-map-modal
    [isOpen]="routeModalOpen"
    [driverCoordinates]="selectedRouteBooking?.driverCoordinates"
    [pickupCoordinates]="selectedRouteBooking?.employerCoordinates"
    [status]="selectedRouteBooking?.status || ''"
    [driverLabel]="'Driver'"
    [pickupLabel]="selectedRouteBooking?.pickup || 'Employer pickup'"
    [destinationLabel]="selectedRouteBooking?.destination || ''"
    [routeTitle]="selectedRouteBooking ? selectedRouteBooking.pickup + ' to ' + selectedRouteBooking.destination : 'Requested route'"
    (close)="closeRouteMap()">
  </app-route-map-modal>
</div>
  `,
  styles: [`
:host { --workspace-bg:#070b13; --panel-bg:#0d1420; --border-color:rgba(255,255,255,.1); display:block; }
.driver-workspace { --background:var(--workspace-bg); --color:#f8fafc; }
.workspace-shell { box-sizing:border-box; max-width:1100px; margin:auto; padding:calc(env(safe-area-inset-top) + 20px) 18px 20px; }
.workspace-header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:18px; }
.workspace-header h1 { color:#f8fafc; margin:0 0 6px; font-size:28px; }
.workspace-header p { color:#cbd5e1; margin:0; }
.eyebrow,.panel-kicker { color:#d8b4fe; font-size:11px; font-weight:800; letter-spacing:1.3px; margin:0 0 6px; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
.summary-grid article,.panel { background:linear-gradient(150deg,#111a29,#0b111b); border:1px solid var(--border-color); border-radius:18px; padding:18px; }
.summary-grid span { color:#cbd5e1; display:block; font-size:12px; margin-bottom:8px; }
.summary-grid strong { color:#f8fafc; display:block; font-size:26px; }
.panel-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
.panel-header h2 { color:#f8fafc; margin:0; font-size:18px; }
.booking-row { display:grid; grid-template-columns:44px 1fr auto; gap:12px; align-items:center; padding:14px 0; border-bottom:1px solid rgba(255,255,255,.07); }
.booking-row:last-child { border-bottom:0; }
.booking-icon { width:38px; height:38px; display:grid; place-items:center; border-radius:11px; color:#93c5fd; background:rgba(59,130,246,.18); }
.booking-row h3 { color:#f8fafc; margin:0 0 5px; font-size:15px; }
.booking-row p,.booking-row span,.state { color:#cbd5e1; margin:0; font-size:12px; }
.booking-row span { display:inline-flex; align-items:center; gap:5px; }
.driver-note { display:inline-flex; align-items:center; gap:5px; margin-top:5px; padding:6px 8px; border-radius:8px; color:#dbeafe; background:rgba(59,130,246,.15); font-size:11px; line-height:1.3; }
.driver-note ion-icon { flex:0 0 auto; color:#93c5fd; font-size:14px; }
.state { padding:24px 0; text-align:center; }
.error { color:#fecaca; }
.status-pill { padding:6px 10px; border-radius:20px; font-size:11px; white-space:nowrap; color:#f3e8ff; background:rgba(168,85,247,.28); }
.pending { color:#fef3c7; background:rgba(245,158,11,.24); }
.completed,.started,.arrived { color:#dcfce7; background:rgba(34,197,94,.24); }
.booking-side { display:grid; justify-items:end; gap:8px; }
.row-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:6px; max-width:220px; }
.row-actions ion-button { margin:0; --border-radius:8px; font-size:11px; }
.cancelled { color:#fecaca; background:rgba(239,68,68,.22); }
.driver-bottom-nav { background:rgba(8,13,21,.96); backdrop-filter:blur(20px); border-top:1px solid rgba(255,255,255,.08); padding-bottom:env(safe-area-inset-bottom); }
.bottom-nav { max-width:700px; margin:auto; display:grid; grid-template-columns:repeat(5,1fr); align-items:center; min-height:70px; }
.nav-item { border:0; background:transparent; color:#cbd5e1; display:flex; flex-direction:column; align-items:center; gap:5px; font-size:10px; }
.nav-item ion-icon { color:currentColor; font-size:22px; }
.nav-item.active { color:#d8b4fe; }
.availability-nav div { width:50px; height:50px; margin-top:-30px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; box-shadow:0 10px 30px rgba(124,58,237,.4); }
@media (max-width:650px) { .workspace-header { align-items:flex-start; flex-direction:column; } .summary-grid { grid-template-columns:repeat(2,1fr); } .booking-row { grid-template-columns:38px 1fr; } .booking-side { grid-column:2; justify-items:start; } .status-pill { width:max-content; } .row-actions { justify-content:flex-start; } }
  `],
})
export class DriverBookingsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  readonly auth = inject(AuthService);
  bookings: Booking[] = [];
  selectedRouteBooking: Booking | null = null;
  routeModalOpen = false;
  loading = true;
  error = '';
  private refreshId?: number;

  async ngOnInit() {
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 12000);
  }
  ngOnDestroy() { if (this.refreshId) window.clearInterval(this.refreshId); }
  async refresh(event: CustomEvent) { try { await this.load(false); } finally { await (event.target as any)?.complete(); } }
  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      const result = await this.api.get<{ bookings?: Booking[] }>('/drivers/me/bookings', token);
      this.bookings = Array.isArray(result.bookings) ? result.bookings : [];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load bookings';
    } finally {
      this.loading = false;
    }
  }
  count(status: BookingStatus) { return this.bookings.filter((booking) => booking.status === status).length; }
  relativeBookingTime(booking: Booking) { return relativeTime(this.bookingActivityDate(booking)); }
  async acceptBooking(booking: Booking) { await this.captureLocationForBooking(); await this.updateBooking(booking, 'accept'); }
  async rejectBooking(booking: Booking) { await this.updateBooking(booking, 'reject'); }
  async startTrip(booking: Booking) { await this.captureLocationForBooking(); await this.updateBooking(booking, 'start'); }
  async markArrived(booking: Booking) { await this.updateBooking(booking, 'arrived'); }
  openRoute(booking: Booking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }
  private async updateBooking(booking: Booking, action: 'accept' | 'reject' | 'start' | 'arrived') {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      await this.api.patch(`/bookings/${booking.id}/${action}`, {}, token);
      await this.load();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Booking update failed';
    }
  }
  private async captureLocationForBooking() {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      await this.api.patch('/drivers/me/location', { latitude: position.coords.latitude, longitude: position.coords.longitude }, token);
    } catch { /* Location permission failure does not block accepting the booking. */ }
  }
  navigate(route: string) { void this.router.navigateByUrl(route); }
  logout() { this.auth.logout(); }
  private bookingActivityDate(booking: Booking) {
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
