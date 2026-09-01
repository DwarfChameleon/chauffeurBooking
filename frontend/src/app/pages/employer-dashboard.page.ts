import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { EmployerNavComponent } from './employer-nav.component';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { RealtimeService } from '../core/realtime.service';
import { RouteCoordinate } from '../shared/route-map.component';
import { RouteMapModalComponent } from '../shared/route-map-modal.component';

type ChauffeurCard = {
  id: string; name: string; picture: string | null; rating: number | null; route: string; routeState: string;
  distanceLabel: string; experienceLevel: string; readinessScore: number; yearsOfExperience: number; vehicleType: string;
  safetyLevel: string; accidentCount: number; completedTrips: number;
};
type Employer = { name: string; email: string; phone: string; employerProfile: { profilePicture: string; companyName: string; state: string; city: string } };
type Booking = { id: string; driverName: string; driverPicture: string | null; serviceType: string; urgency: string; status: string; pickupAddress: string; destinationAddress?: string; notes?: string; displayDate: string; displayTime: string; routeUrl?: string; driverCoordinates?: RouteCoordinate; employerCoordinates?: RouteCoordinate; acceptedAt?: string; startedAt?: string; arrivedAt?: string; completedAt?: string; createdAt?: string; updatedAt?: string };
type Completeness = { score: number; completed: number; total: number; verified: boolean; checks: { key: string; label: string; complete: boolean }[] };
type DashboardResponse = {
  employer: Employer;
  completeness: Completeness;
  stats: { activeRequests: number; completedTrips: number; cancelledTrips: number; totalBookings: number; availableChauffeurs: number };
  currentBooking: Booking | null;
  bookingHistory: Booking[];
  nearbyChauffeurs: ChauffeurCard[];
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent, RouteMapModalComponent],
  template: `
<div class="employer-page">
  <app-workspace-header role="employer" title="Dashboard" [notificationCount]="notificationCount" [showSignout]="false" [showMenu]="true" (refreshRequested)="load(false)"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="page-shell">
      <section class="dashboard-intro">
        <div class="identity">
          <img *ngIf="employer?.employerProfile?.profilePicture; else avatarFallback" [src]="employer?.employerProfile?.profilePicture" alt="">
          <ng-template #avatarFallback><div class="avatar"><ion-icon name="business-outline"></ion-icon></div></ng-template>
          <div>
            <p class="eyebrow">Employer dashboard</p>
            <h1>{{ employer?.employerProfile?.companyName || employer?.name || 'Employer workspace' }}</h1>
            <span>{{ employer?.employerProfile?.city || 'City pending' }}{{ employer?.employerProfile?.state ? ', ' + employer?.employerProfile?.state : '' }}</span>
          </div>
        </div>
      </section>

      <p class="state error" *ngIf="error">{{ error }}</p>
      <p class="state success" *ngIf="success">{{ success }}</p>

      <section class="summary-grid">
        <article class="work-panel current-booking clickable-card" [class.disabled-card]="!currentBooking" (click)="openBookingEditor()" tabindex="0" (keydown.enter)="openBookingEditor()" (keydown.space)="openBookingEditor()">
          <div class="panel-head">
            <div><p class="eyebrow">Current booking</p><h2>{{ currentBooking ? currentBooking.driverName : 'No active chauffeur request' }}</h2></div>
            <ion-icon name="briefcase-outline"></ion-icon>
          </div>
          <ng-container *ngIf="currentBooking; else noCurrentBooking">
            <div class="booking-line"><span>{{ serviceLabel(currentBooking.serviceType) }}</span><strong>{{ currentBooking.status }}</strong></div>
            <p>{{ currentBooking.pickupAddress }}</p>
            <p class="destination-line" *ngIf="currentBooking.destinationAddress"><ion-icon name="navigate-outline"></ion-icon>{{ currentBooking.destinationAddress }}</p>
            <div class="meta-row"><span><ion-icon name="calendar-outline"></ion-icon>{{ currentBooking.displayDate }}</span><span><ion-icon name="time-outline"></ion-icon>{{ currentBooking.displayTime }}</span></div>
            <div class="booking-actions">
              <button class="ghost-button tight" type="button" (click)="$event.stopPropagation(); openBookingEditor()"><ion-icon name="create-outline"></ion-icon> Update route</button>
              <button class="ghost-button tight" type="button" *ngIf="currentBooking.routeUrl" (click)="$event.stopPropagation(); openRoute(currentBooking)"><ion-icon name="map-outline"></ion-icon> View route</button>
              <button class="success-button tight" type="button" *ngIf="currentBooking.status === 'arrived'" (click)="$event.stopPropagation(); confirmDestination(currentBooking)" [disabled]="savingBooking"><ion-icon name="checkmark-circle-outline"></ion-icon> Confirm Destination</button>
            </div>
          </ng-container>
          <ng-template #noCurrentBooking>
            <p>Book a chauffeur when you are ready. Available drivers refresh automatically.</p>
            <button class="primary-button" type="button" (click)="navigate('/employer/chauffeurs')"><ion-icon name="car-sport-outline"></ion-icon> Find chauffeur</button>
          </ng-template>
        </article>

        <article class="work-panel completeness-panel clickable-card" (click)="navigate('/employer/profile')" tabindex="0" (keydown.enter)="navigate('/employer/profile')" (keydown.space)="navigate('/employer/profile')">
          <div class="panel-head">
            <div><p class="eyebrow">Profile completeness</p><h2>{{ completeness.score }}%</h2></div>
            <ion-icon [name]="completeness.verified ? 'checkmark-circle' : 'shield-checkmark-outline'"></ion-icon>
          </div>
          <div class="progress-track"><span [style.width.%]="completeness.score"></span></div>
          <p>{{ completeness.completed }} of {{ completeness.total }} profile checks complete. {{ completeness.verified ? 'Verified badge active.' : 'Documents await admin verification.' }}</p>
          <button class="ghost-button tight" type="button" (click)="$event.stopPropagation(); navigate('/employer/profile')"><ion-icon name="person-circle-outline"></ion-icon> Update profile</button>
        </article>
      </section>

      <section class="route-control work-panel" *ngIf="selectedBooking">
        <div class="panel-head">
          <div><p class="eyebrow">Active booking control</p><h2>{{ selectedBooking.driverName }} route and destination</h2></div>
          <button class="icon-button" type="button" (click)="selectedBooking = null" aria-label="Close booking control"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="route-status">
          <span><ion-icon name="briefcase-outline"></ion-icon>{{ selectedBooking.status }}</span>
          <span><ion-icon name="time-outline"></ion-icon>{{ selectedBooking.displayDate }} · {{ selectedBooking.displayTime }}</span>
        </div>
        <div class="route-form">
          <label>Pickup / employer location<textarea rows="3" [(ngModel)]="bookingForm.pickupAddress" (ngModelChange)="markBookingFormDirty()" placeholder="Where should the driver meet the employer?"></textarea></label>
          <label>Destination / delivery point<textarea rows="3" [(ngModel)]="bookingForm.destinationAddress" (ngModelChange)="markBookingFormDirty()" placeholder="Where should the trip or delivery end?"></textarea></label>
          <label class="wide">Instruction for driver<textarea rows="3" [(ngModel)]="bookingForm.notes" (ngModelChange)="markBookingFormDirty()" placeholder="Gate access, passenger name, package instruction, or route note"></textarea></label>
        </div>
        <div class="route-actions">
          <button class="primary-button" type="button" (click)="saveBookingDetails()" [disabled]="savingBooking"><ion-icon name="save-outline"></ion-icon>{{ savingBooking ? 'Saving...' : 'Save route details' }}</button>
          <button class="ghost-button" type="button" *ngIf="selectedBooking.routeUrl" (click)="openRoute(selectedBooking)"><ion-icon name="map-outline"></ion-icon> View route</button>
          <button class="success-button" type="button" *ngIf="selectedBooking.status === 'arrived'" (click)="confirmDestination(selectedBooking)" [disabled]="savingBooking"><ion-icon name="checkmark-circle-outline"></ion-icon> Confirm Destination Delivery</button>
        </div>
        <p class="hint" *ngIf="selectedBooking.status !== 'arrived'">Destination delivery can be confirmed after the driver taps Arrived at Destination.</p>
      </section>

      <section class="stats-grid">
        <article class="stat-card clickable-card" (click)="currentBooking ? openBookingEditor() : navigate('/book-driver')" tabindex="0" (keydown.enter)="currentBooking ? openBookingEditor() : navigate('/book-driver')" (keydown.space)="currentBooking ? openBookingEditor() : navigate('/book-driver')"><ion-icon name="time-outline"></ion-icon><span>Active</span><strong>{{ stats.activeRequests }}</strong></article>
        <article class="stat-card clickable-card" (click)="navigate('/book-driver')" tabindex="0" (keydown.enter)="navigate('/book-driver')" (keydown.space)="navigate('/book-driver')"><ion-icon name="checkmark-circle-outline"></ion-icon><span>Completed</span><strong>{{ stats.completedTrips }}</strong></article>
        <article class="stat-card clickable-card" (click)="navigate('/book-driver')" tabindex="0" (keydown.enter)="navigate('/book-driver')" (keydown.space)="navigate('/book-driver')"><ion-icon name="calendar-outline"></ion-icon><span>Total bookings</span><strong>{{ stats.totalBookings }}</strong></article>
        <article class="stat-card clickable-card" (click)="navigate('/employer/chauffeurs')" tabindex="0" (keydown.enter)="navigate('/employer/chauffeurs')" (keydown.space)="navigate('/employer/chauffeurs')"><ion-icon name="car-sport-outline"></ion-icon><span>Available</span><strong>{{ stats.availableChauffeurs }}</strong></article>
      </section>

      <section class="two-column">
        <article class="work-panel">
          <div class="panel-head"><div><p class="eyebrow">Booking history</p><h2>Recent requests</h2></div><button class="link-button" type="button" (click)="navigate('/book-driver')">View all</button></div>
          <div class="list-row" *ngFor="let booking of bookingHistory">
            <span class="row-icon"><ion-icon name="calendar-outline"></ion-icon></span>
            <div><strong>{{ booking.driverName }}</strong><p>{{ booking.pickupAddress }}</p></div>
            <small><ion-icon name="time-outline"></ion-icon>{{ relativeBookingTime(booking) }} · {{ booking.status }}</small>
          </div>
          <div class="empty" *ngIf="bookingHistory.length === 0">No booking history yet.</div>
        </article>

        <article class="work-panel">
          <div class="panel-head"><div><p class="eyebrow">Live chauffeurs</p><h2>Best nearby matches</h2></div><button class="link-button" type="button" (click)="navigate('/employer/chauffeurs')">View all</button></div>
          <div class="driver-row" *ngFor="let driver of nearbyChauffeurs">
            <img *ngIf="driver.picture; else driverFallback" [src]="driver.picture" alt="">
            <ng-template #driverFallback><span class="driver-fallback"><ion-icon name="person-circle-outline"></ion-icon></span></ng-template>
            <div><strong>{{ driver.name }}</strong><p>{{ driver.distanceLabel }} · {{ driver.safetyLevel }}</p></div>
            <small>{{ driver.rating === null ? 'New' : (driver.rating | number:'1.1-1') }}</small>
          </div>
          <div class="empty" *ngIf="nearbyChauffeurs.length === 0">No available chauffeur match yet.</div>
        </article>
      </section>
    </main>
  </ion-content>
  <app-employer-nav active="dashboard"></app-employer-nav>
  <app-route-map-modal
    [isOpen]="routeModalOpen"
    [driverCoordinates]="selectedRouteBooking?.driverCoordinates"
    [pickupCoordinates]="selectedRouteBooking?.employerCoordinates"
    [status]="selectedRouteBooking?.status || ''"
    [driverLabel]="selectedRouteBooking?.driverName || 'Driver'"
    [pickupLabel]="selectedRouteBooking?.pickupAddress || 'Employer pickup'"
    [routeTitle]="selectedRouteBooking ? selectedRouteBooking.pickupAddress + ' to ' + selectedRouteBooking.driverName : 'Requested route'"
    (close)="closeRouteMap()">
  </app-route-map-modal>
</div>
  `,
  styles: [`
:host { display:block; --ink:#172033; --muted:#667085; --line:#e6ebf2; --blue:#1954d1; --green:#12805c; }
.employer-page { min-height:100%; background:#f7f9fc; color:var(--ink); }
.page-shell { max-width:1160px; margin:0 auto; padding:22px 18px 92px; }
.dashboard-intro,.identity,.top-actions,.panel-head,.meta-row,.booking-line,.route-status,.route-actions { display:flex; align-items:center; }
.dashboard-intro { justify-content:space-between; gap:16px; margin-bottom:18px; }
.identity { gap:12px; min-width:0; }
.identity img,.avatar { width:48px; height:48px; border-radius:8px; object-fit:cover; background:#e9eef8; }
.avatar { display:grid; place-items:center; color:#1954d1; }
.avatar ion-icon { font-size:28px; }
.eyebrow { margin:0 0 5px; color:#5571a7; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
h1,h2,p { margin-top:0; }
h1 { margin-bottom:3px; font-size:24px; line-height:1.1; }
h2 { margin-bottom:0; font-size:18px; }
.identity span,.work-panel p,.list-row p,.driver-row p { color:var(--muted); }
.top-actions { gap:9px; }
button { font:inherit; }
.icon-button,.ghost-button,.primary-button,.success-button,.link-button { border:0; border-radius:8px; cursor:pointer; font-weight:800; }
.icon-button { display:grid; place-items:center; width:38px; height:38px; color:var(--blue); background:#eaf1ff; }
.icon-button ion-icon { font-size:20px; }
.ghost-button,.primary-button,.success-button,.link-button { display:inline-flex; align-items:center; gap:6px; min-height:38px; padding:0 12px; color:var(--blue); background:#edf3ff; }
.ghost-button.tight { min-height:34px; margin-top:10px; }
.primary-button { color:#fff; background:var(--blue); }
.success-button { color:#fff; background:var(--green); }
.booking-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.booking-actions .tight { margin-top:0; min-height:34px; }
.link-button { padding:0; min-height:auto; background:transparent; }
.summary-grid { display:grid; grid-template-columns:1.2fr .8fr; gap:14px; }
.work-panel,.stat-card { border:1px solid var(--line); border-radius:8px; background:#fff; box-shadow:0 8px 22px rgba(20,32,61,.04); }
.work-panel:nth-child(1) { border-top:4px solid #1954d1; }
.work-panel:nth-child(2) { border-top:4px solid #7c3aed; }
.stats-grid .stat-card:nth-child(1) { border-top:4px solid #1954d1; background:linear-gradient(180deg,#eef4ff,#fff 42%); }
.stats-grid .stat-card:nth-child(2) { border-top:4px solid #12805c; background:linear-gradient(180deg,#ecfaf4,#fff 42%); }
.stats-grid .stat-card:nth-child(3) { border-top:4px solid #7c3aed; background:linear-gradient(180deg,#f4efff,#fff 42%); }
.stats-grid .stat-card:nth-child(4) { border-top:4px solid #f59e0b; background:linear-gradient(180deg,#fff8e8,#fff 42%); }
.work-panel { padding:18px; }
.panel-head { justify-content:space-between; gap:12px; margin-bottom:14px; }
.panel-head > ion-icon { color:#7890bd; font-size:26px; }
.current-booking p { margin-bottom:14px; line-height:1.5; }
.clickable-card { cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.clickable-card:hover,.clickable-card:focus-visible { transform:translateY(-1px); border-color:#b9ccf5; box-shadow:0 12px 28px rgba(20,32,61,.08); outline:0; }
.disabled-card { cursor:default; }
.disabled-card:hover,.disabled-card:focus-visible { transform:none; }
.destination-line { display:flex; align-items:center; gap:7px; }
.destination-line ion-icon { color:#7c3aed; }
.booking-line { justify-content:space-between; gap:8px; margin-bottom:10px; }
.booking-line span,.booking-line strong { padding:5px 8px; border-radius:8px; font-size:11px; font-weight:900; }
.booking-line span { color:#1954d1; background:#edf3ff; }
.booking-line strong { color:#12805c; background:#e9f8f2; text-transform:capitalize; }
.meta-row { flex-wrap:wrap; gap:12px; color:#667085; font-size:12px; }
.meta-row span,.list-row small,.driver-row small { display:inline-flex; align-items:center; gap:5px; }
.progress-track { height:9px; overflow:hidden; border-radius:999px; background:#e9eef8; }
.progress-track span { display:block; height:100%; border-radius:999px; background:var(--green); }
.stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:14px 0; }
.route-control { margin:14px 0; border-top:4px solid #12805c; }
.route-status { flex-wrap:wrap; gap:10px; margin-bottom:14px; color:#667085; font-size:12px; }
.route-status span { display:inline-flex; align-items:center; gap:6px; padding:7px 9px; border-radius:8px; background:#f3f7fd; text-transform:capitalize; }
.route-form { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.route-form label { display:grid; gap:7px; color:#53617a; font-size:12px; font-weight:850; }
.route-form .wide { grid-column:1 / -1; }
.route-form textarea { width:100%; box-sizing:border-box; padding:11px; border:1px solid #d9e1ed; border-radius:8px; color:var(--ink); background:#fbfcfe; font:inherit; resize:vertical; }
.route-actions { flex-wrap:wrap; gap:9px; margin-top:14px; }
.hint { margin:10px 0 0; color:#667085; font-size:12px; }
.stat-card { position:relative; min-height:88px; padding:15px; overflow:hidden; }
.stat-card ion-icon { color:#93a8cf; font-size:22px; }
.stat-card span { display:block; margin-top:10px; color:#667085; font-size:12px; font-weight:800; }
.stat-card strong { display:block; margin-top:4px; font-size:26px; }
.two-column { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.list-row,.driver-row { display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:center; padding:12px 0; border-top:1px solid #edf1f6; }
.row-icon,.driver-fallback { display:grid; place-items:center; width:38px; height:38px; border-radius:8px; color:#1954d1; background:#edf3ff; }
.driver-row img { width:38px; height:38px; border-radius:8px; object-fit:cover; }
.list-row strong,.driver-row strong { font-size:13px; }
.list-row p,.driver-row p { margin:3px 0 0; font-size:11px; }
.list-row small,.driver-row small { color:#667085; font-size:11px; text-transform:capitalize; }
.empty,.state { padding:18px 0; color:var(--muted); text-align:center; }
.error { color:#b91c1c; }
@media (max-width:820px) { .summary-grid,.two-column { grid-template-columns:1fr; } .stats-grid { grid-template-columns:repeat(2,1fr); } }
@media (max-width:620px) { .page-shell { padding:17px 13px 92px; } .dashboard-intro { align-items:flex-start; } .top-actions { align-items:flex-end; flex-direction:column; } h1 { font-size:20px; } .stats-grid { gap:9px; } .route-form { grid-template-columns:1fr; } .route-form .wide { grid-column:auto; } }
  `],
})
export class EmployerDashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly auth = inject(AuthService);
  employer: Employer | null = null;
  stats = { activeRequests: 0, completedTrips: 0, cancelledTrips: 0, totalBookings: 0, availableChauffeurs: 0 };
  notificationCount = 0;
  completeness: Completeness = { score: 0, completed: 0, total: 8, verified: false, checks: [] };
  currentBooking: Booking | null = null;
  selectedBooking: Booking | null = null;
  selectedRouteBooking: Booking | null = null;
  routeModalOpen = false;
  bookingForm = { pickupAddress: '', destinationAddress: '', notes: '' };
  bookingHistory: Booking[] = [];
  nearbyChauffeurs: ChauffeurCard[] = [];
  loading = true;
  savingBooking = false;
  error = '';
  success = '';
  private refreshId?: number;
  private bookingFormDirty = false;

  async ngOnInit() {
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 12000);
  }

  ngOnDestroy() {
    if (this.refreshId) window.clearInterval(this.refreshId);
  }

  async refresh(event: CustomEvent) { try { await this.load(false); } finally { await (event.target as any)?.complete(); } }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    if (showLoading) this.loading = true;
    try {
      const data = await this.api.get<DashboardResponse>('/employers/me/dashboard', token);
      this.employer = data.employer;
      this.stats = { ...this.stats, ...data.stats };
      this.completeness = data.completeness || this.completeness;
      this.currentBooking = data.currentBooking || null;
      if (this.selectedBooking && this.currentBooking?.id === this.selectedBooking.id) {
        this.selectedBooking = this.currentBooking;
        this.syncBookingForm(this.currentBooking);
      }
      this.bookingHistory = data.bookingHistory || [];
      this.nearbyChauffeurs = data.nearbyChauffeurs || [];
      this.notificationCount = (this.currentBooking ? 1 : 0) + Math.min(this.bookingHistory.length, 3) + 1;
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load employer dashboard';
    } finally {
      this.loading = false;
    }
  }

  serviceLabel(value: string) {
    return value ? value.replace(/_/g, ' ') : 'chauffeur';
  }

  navigate(path: string) { void this.router.navigateByUrl(path); }
  openRoute(booking: Booking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }
  openBookingEditor() {
    if (!this.currentBooking) return;
    this.selectedBooking = this.currentBooking;
    this.syncBookingForm(this.currentBooking, true);
  }
  async saveBookingDetails() {
    const token = this.auth.session()?.token;
    if (!token || !this.selectedBooking) return;
    this.savingBooking = true;
    this.error = '';
    this.success = '';
    try {
      const response = await this.api.patch<{ booking: Booking }>(`/bookings/${this.selectedBooking.id}`, {
        pickupLocation: { address: this.bookingForm.pickupAddress },
        destinationLocation: { address: this.bookingForm.destinationAddress },
        notes: this.bookingForm.notes,
      }, token);
      const savedBooking = this.normalizeSavedBooking(response.booking, this.selectedBooking);
      this.currentBooking = savedBooking;
      this.selectedBooking = savedBooking;
      this.syncBookingForm(savedBooking, true);
      this.success = 'Route details saved and sent to the driver.';
      await this.load(false);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save booking route';
    } finally {
      this.savingBooking = false;
    }
  }
  async confirmDestination(booking: Booking) {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.savingBooking = true;
    try {
      await this.api.patch(`/bookings/${booking.id}/confirm-destination`, {}, token);
      await this.load(false);
      this.selectedBooking = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not confirm destination';
    } finally {
      this.savingBooking = false;
    }
  }
  back() { if (globalThis.history.length > 1) this.location.back(); else this.navigate('/employer/dashboard'); }
  logout() { this.auth.logout(); }
  markBookingFormDirty() {
    this.bookingFormDirty = true;
    this.success = '';
  }
  private syncBookingForm(booking: Booking, force = false) {
    if (this.bookingFormDirty && !force) return;
    this.bookingForm = {
      pickupAddress: booking.pickupAddress || '',
      destinationAddress: booking.destinationAddress || '',
      notes: booking.notes || '',
    };
    this.bookingFormDirty = false;
  }
  private normalizeSavedBooking(savedBooking: any, fallback: Booking): Booking {
    return {
      ...fallback,
      id: savedBooking?._id || savedBooking?.id || fallback.id,
      driverName: savedBooking?.driver?.user?.name || savedBooking?.driver?.name || fallback.driverName,
      driverPicture: savedBooking?.driver?.profilePicture || savedBooking?.driverPicture || fallback.driverPicture,
      serviceType: savedBooking?.serviceType || fallback.serviceType,
      urgency: savedBooking?.urgency || fallback.urgency,
      status: savedBooking?.status || fallback.status,
      pickupAddress: savedBooking?.pickupLocation?.address || fallback.pickupAddress,
      destinationAddress: savedBooking?.destinationLocation?.address || fallback.destinationAddress,
      notes: typeof savedBooking?.notes === 'string' ? savedBooking.notes : fallback.notes,
      displayDate: savedBooking?.date ? new Date(savedBooking.date).toLocaleDateString() : fallback.displayDate,
      displayTime: savedBooking?.date ? new Date(savedBooking.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : fallback.displayTime,
      routeUrl: savedBooking?.routeUrl || fallback.routeUrl,
      driverCoordinates: savedBooking?.driverCoordinates || fallback.driverCoordinates,
      employerCoordinates: savedBooking?.employerCoordinates || fallback.employerCoordinates,
      acceptedAt: savedBooking?.acceptedAt || fallback.acceptedAt,
      startedAt: savedBooking?.startedAt || fallback.startedAt,
      arrivedAt: savedBooking?.arrivedAt || fallback.arrivedAt,
      completedAt: savedBooking?.completedAt || fallback.completedAt,
      createdAt: savedBooking?.createdAt || fallback.createdAt,
      updatedAt: savedBooking?.updatedAt || fallback.updatedAt,
    };
  }
  relativeBookingTime(booking: Booking) {
    return relativeTime(this.bookingActivityDate(booking));
  }
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
