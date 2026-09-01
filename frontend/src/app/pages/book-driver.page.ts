import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { RealtimeService } from '../core/realtime.service';
import { EmployerNavComponent } from './employer-nav.component';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { RouteCoordinate } from '../shared/route-map.component';
import { RouteMapModalComponent } from '../shared/route-map-modal.component';

type RouteCoverage = { state: string; routes: string; years: number; isCurrent: boolean };
type Driver = { id: string; name: string; picture: string | null; rating: number | null; distanceLabel: string; experienceLevel: string; safetyLevel: string; vehicleType: string; route?: string; routeState?: string; routeCoverage?: RouteCoverage[]; routeCoverageLabel?: string };
type Booking = { id: string; driverName: string; driverPicture?: string | null; serviceType: string; urgency: string; status: string; pickupAddress: string; destinationAddress?: string; displayDate: string; displayTime: string; notes?: string; routeUrl?: string; driverCoordinates?: RouteCoordinate; employerCoordinates?: RouteCoordinate; acceptedAt?: string; startedAt?: string; arrivedAt?: string; completedAt?: string; createdAt?: string; updatedAt?: string };
type DashboardResponse = { currentBooking: Booking | null; bookingHistory: Booking[]; nearbyChauffeurs: Driver[] };
type ChauffeurResponse = { drivers: Driver[] };
const INTERSTATE_STATES = ['Bayelsa', 'Delta', 'Benin', 'Rivers', 'Calabar', 'Abia', 'Akwa Ibom', 'Edo', 'Abuja', 'Lagos'];

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent, RouteMapModalComponent],
  template: `
<div class="employer-page">
  <app-workspace-header role="employer" title="Bookings" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="page-shell">
      <section class="page-intro"><div><p class="eyebrow">Bookings</p><h1>Request and history</h1><span>Book chauffeurs and track recent employer requests.</span></div></section>

      <p class="state error" *ngIf="error">{{ error }}</p>
      <p class="state success" *ngIf="success">{{ success }}</p>

      <section class="booking-layout">
        <article class="panel request-panel">
          <div class="panel-head"><div><p class="eyebrow">New booking</p><h2>{{ selectedDriver ? selectedDriver.name : 'Choose a chauffeur' }}</h2></div><ion-icon name="calendar-outline"></ion-icon></div>
          <div class="booking-start" *ngIf="!showBookingForm">
            <div class="start-icon"><ion-icon name="car-sport-outline"></ion-icon></div>
            <h3>Book New Chauffeur</h3>
            <p>Select a verified nearby driver first, then complete pickup, destination and timing details.</p>
            <div class="start-actions">
              <button class="primary-button" type="button" (click)="startNewBooking()"><ion-icon name="add-circle-outline"></ion-icon> Book New Chauffeur</button>
              <button class="ghost-button" type="button" (click)="navigate('/employer/chauffeurs')"><ion-icon name="people-outline"></ion-icon> Choose from directory</button>
            </div>
          </div>
          <ng-container *ngIf="showBookingForm">
          <div class="selected-driver" *ngIf="selectedDriver">
            <img *ngIf="selectedDriver.picture; else driverFallback" [src]="selectedDriver.picture" alt="">
            <ng-template #driverFallback><span><ion-icon name="person-circle-outline"></ion-icon></span></ng-template>
            <div><strong>{{ selectedDriver.experienceLevel }}</strong><p>{{ selectedDriver.distanceLabel }} · {{ selectedDriver.safetyLevel }}</p></div>
          </div>
          <div class="select-driver-callout" *ngIf="!selectedDriver">
            <div><strong>No chauffeur selected</strong><p>Pick a nearby chauffeur before submitting the booking request.</p></div>
            <button class="ghost-button tight" type="button" (click)="navigate('/employer/chauffeurs')"><ion-icon name="people-outline"></ion-icon> Choose chauffeur</button>
          </div>
          <div class="form-grid">
            <label>Pickup address<textarea [(ngModel)]="form.pickupAddress" rows="3" placeholder="Office, hotel, home, or dispatch point"></textarea><button class="location-button" type="button" (click)="captureEmployerLocation()"><ion-icon name="locate-outline"></ion-icon>{{ employerLocation ? 'Location shared' : 'Capture/share my location' }}</button></label>
            <label class="wide">Destination address<textarea [(ngModel)]="form.destinationAddress" rows="3" placeholder="Drop-off point, delivery address, or route destination"></textarea></label>
            <label>Service type<select [(ngModel)]="form.serviceType"><option value="chauffeur">Chauffeur booking</option><option value="emergency_dispatch">Emergency dispatch</option><option value="ride_hailing">Ride-hailing</option><option value="logistics">Logistics</option><option value="field_verification">Field verification</option></select></label>
            <label>Urgency<select [(ngModel)]="form.urgency"><option value="standard">Standard</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></label>
            <div class="trip-scope wide">
              <span>Trip coverage</span>
              <div class="scope-toggle">
                <button type="button" [class.active]="form.tripScope === 'local'" (click)="setTripScope('local')">Local</button>
                <button type="button" [class.active]="form.tripScope === 'interstate'" (click)="setTripScope('interstate')">Inter-state</button>
              </div>
            </div>
            <label *ngIf="form.tripScope === 'interstate'">Service state<select [(ngModel)]="form.routeState" (ngModelChange)="onRouteStateChange()"><option value="">Select service state</option><option *ngFor="let state of interstateStates" [value]="state">{{ state }}</option></select></label>
            <label>Time<input [(ngModel)]="form.dateTime" type="datetime-local"></label>
            <label class="wide">Notes<textarea [(ngModel)]="form.notes" rows="3" placeholder="Destination, route, passenger notes, or special instruction"></textarea></label>
          </div>
          <div class="route-warning" *ngIf="routeMismatchMessage">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <div><strong>{{ routeMismatchMessage }}</strong><p>Select another chauffeur with {{ form.routeState }} route coverage.</p></div>
            <button class="ghost-button tight" type="button" (click)="showRouteSuggestions = true">Select another driver</button>
          </div>
          <div class="route-suggestions" *ngIf="showRouteSuggestions && form.tripScope === 'interstate'">
            <button class="driver-row" type="button" *ngFor="let driver of suggestedRouteDrivers" (click)="selectDriver(driver)">
              <img *ngIf="driver.picture; else suggestedFallback" [src]="driver.picture" alt="">
              <ng-template #suggestedFallback><span><ion-icon name="person-circle-outline"></ion-icon></span></ng-template>
              <div><strong>{{ driver.name }}</strong><p>{{ driverRouteSummary(driver) }}</p></div>
              <small>{{ driver.rating === null ? 'New' : (driver.rating | number:'1.1-1') }}</small>
            </button>
            <p class="empty compact" *ngIf="suggestedRouteDrivers.length === 0">No available chauffeur currently lists {{ form.routeState || 'that state' }} route coverage.</p>
          </div>
          <ion-button expand="block" (click)="dispatch()" [disabled]="dispatching || !selectedDriver || hasRouteMismatch">{{ dispatching ? 'Submitting...' : 'Submit booking request' }}</ion-button>
          </ng-container>
        </article>

        <aside class="panel current-panel">
          <div class="panel-head"><div><p class="eyebrow">Current booking</p><h2>{{ currentBooking ? currentBooking.driverName : 'None active' }}</h2></div><ion-icon name="briefcase-outline"></ion-icon></div>
          <ng-container *ngIf="currentBooking; else noActive">
            <p>{{ currentBooking.pickupAddress }}</p>
            <div class="status-line"><span>{{ currentBooking.status }}</span><small>{{ currentBooking.displayDate }} · {{ currentBooking.displayTime }}</small></div>
            <div class="current-actions">
              <button class="ghost-button tight" type="button" *ngIf="currentBooking.routeUrl" (click)="openRoute(currentBooking)"><ion-icon name="map-outline"></ion-icon> View route</button>
              <button class="success-button tight" type="button" *ngIf="currentBooking.status === 'arrived'" (click)="confirmDestination(currentBooking)" [disabled]="dispatching"><ion-icon name="checkmark-circle-outline"></ion-icon> Confirm Destination</button>
            </div>
          </ng-container>
          <ng-template #noActive><p>No active employer booking at the moment.</p></ng-template>
        </aside>
      </section>

      <section class="two-column">
        <article class="panel">
          <div class="panel-head"><div><p class="eyebrow">Available chauffeurs</p><h2>Select driver</h2></div><button class="link-button" type="button" (click)="navigate('/employer/chauffeurs')">Directory</button></div>
          <button class="driver-row" [class.selected]="selectedDriver?.id === driver.id" type="button" *ngFor="let driver of drivers" (click)="selectDriver(driver)">
            <img *ngIf="driver.picture; else miniFallback" [src]="driver.picture" alt="">
            <ng-template #miniFallback><span><ion-icon name="person-circle-outline"></ion-icon></span></ng-template>
            <div><strong>{{ driver.name }}</strong><p>{{ driver.distanceLabel }} · {{ driver.experienceLevel }}</p></div>
            <small>{{ driver.rating === null ? 'New' : (driver.rating | number:'1.1-1') }}</small>
          </button>
          <div class="empty" *ngIf="drivers.length === 0">No available chauffeurs right now.</div>
        </article>

        <article class="panel">
          <div class="panel-head"><div><p class="eyebrow">History</p><h2>Booking history</h2></div><ion-icon name="document-text-outline"></ion-icon></div>
          <button class="history-row" type="button" *ngFor="let booking of history" (click)="openHistoryModal(booking)">
            <span><ion-icon name="time-outline"></ion-icon></span>
            <div><strong>{{ booking.driverName }}</strong><p>{{ booking.pickupAddress }}</p></div>
            <small>{{ relativeBookingTime(booking) }}<br>{{ statusLabel(booking.status) }}</small>
          </button>
          <div class="empty" *ngIf="history.length === 0">No booking history yet.</div>
        </article>
      </section>
    </main>
  </ion-content>
  <app-employer-nav active="bookings"></app-employer-nav>

  <ion-modal [isOpen]="historyModalOpen" [initialBreakpoint]="0.72" [breakpoints]="[0, 0.5, 0.72, 0.95]" handle="true" handleBehavior="drag" (didDismiss)="closeHistoryModal()">
    <ng-template>
      <div class="booking-detail-sheet" *ngIf="selectedHistoryBooking as booking">
        <div class="modal-drag-grip" aria-hidden="true"><span></span><span></span><span></span></div>
        <header class="sheet-head">
          <div>
            <p class="eyebrow">Booking details</p>
            <h2>{{ booking.driverName }}</h2>
            <span class="sheet-status" [ngClass]="booking.status">{{ statusLabel(booking.status) }}</span>
          </div>
          <button class="modal-close" type="button" (click)="closeHistoryModal()" aria-label="Close booking details"><ion-icon name="close-outline"></ion-icon></button>
        </header>

        <section class="driver-summary">
          <img *ngIf="booking.driverPicture; else sheetDriverFallback" [src]="booking.driverPicture" alt="">
          <ng-template #sheetDriverFallback><span><ion-icon name="person-circle-outline"></ion-icon></span></ng-template>
          <div>
            <strong>{{ booking.driverName }}</strong>
            <p>{{ serviceLabel(booking.serviceType) }} · {{ booking.urgency | titlecase }}</p>
          </div>
        </section>

        <section class="detail-grid">
          <article><ion-icon name="calendar-outline"></ion-icon><span>Date</span><strong>{{ booking.displayDate }}</strong></article>
          <article><ion-icon name="time-outline"></ion-icon><span>Time</span><strong>{{ booking.displayTime }}</strong></article>
          <article><ion-icon name="briefcase-outline"></ion-icon><span>Status</span><strong>{{ statusLabel(booking.status) }}</strong></article>
          <article><ion-icon name="time-outline"></ion-icon><span>Updated</span><strong>{{ relativeBookingTime(booking) }}</strong></article>
        </section>

        <section class="trip-timeline">
          <span><ion-icon name="checkmark-circle-outline"></ion-icon>Accepted: {{ exactEventTime(booking.acceptedAt, 'Not accepted yet') }}</span>
          <span><ion-icon name="play-circle-outline"></ion-icon>Started: {{ exactEventTime(booking.startedAt, 'Not started yet') }}</span>
          <span><ion-icon name="flag-outline"></ion-icon>Arrived: {{ exactEventTime(booking.arrivedAt, 'Not arrived yet') }}</span>
        </section>

        <section class="route-details">
          <div class="route-point pickup"><ion-icon name="location-outline"></ion-icon><div><span>Pickup</span><strong>{{ booking.pickupAddress || 'Pickup location pending' }}</strong></div></div>
          <div class="route-line"></div>
          <div class="route-point destination"><ion-icon name="navigate-outline"></ion-icon><div><span>Destination</span><strong>{{ booking.destinationAddress || booking.notes || 'Destination pending' }}</strong></div></div>
        </section>

        <section class="notes-card">
          <span>Route / instruction</span>
          <p>{{ booking.notes || 'No extra instruction added for this booking.' }}</p>
        </section>

        <div class="sheet-actions">
          <button class="ghost-button" type="button" *ngIf="booking.routeUrl" (click)="openRoute(booking)"><ion-icon name="map-outline"></ion-icon> View route</button>
          <button class="success-button" type="button" *ngIf="booking.status === 'arrived'" (click)="confirmDestination(booking)" [disabled]="dispatching"><ion-icon name="checkmark-circle-outline"></ion-icon> Confirm Destination</button>
        </div>
      </div>
    </ng-template>
  </ion-modal>
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
.topbar,.panel-head,.selected-driver,.status-line,.select-driver-callout,.start-actions,.sheet-head,.driver-summary,.sheet-actions { display:flex; align-items:center; }
.topbar { justify-content:space-between; gap:14px; margin-bottom:16px; }
.topbar h1 { margin:0 0 4px; font-size:25px; line-height:1.12; }
.topbar span,.panel p,.driver-row p,.history-row p,.empty { color:var(--muted); }
.eyebrow { margin:0 0 5px; color:#5571a7; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
button,input,select,textarea { font:inherit; }
.icon-button,.ghost-button,.primary-button,.link-button { border:0; border-radius:8px; cursor:pointer; font-weight:850; }
.icon-button { display:grid; place-items:center; width:38px; height:38px; color:var(--blue); background:#eaf1ff; }
.ghost-button,.success-button,.primary-button,.link-button { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:38px; padding:0 12px; color:var(--blue); background:#edf3ff; }
.primary-button { color:#fff; background:var(--blue); }
.success-button { color:#fff; background:var(--green); }
.tight { min-height:34px; }
.link-button { min-height:auto; padding:0; background:transparent; }
.current-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.booking-layout { display:grid; grid-template-columns:1fr 340px; gap:14px; margin-bottom:14px; }
.two-column { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.panel { padding:18px; border:1px solid var(--line); border-radius:8px; background:#fff; box-shadow:0 8px 22px rgba(20,32,61,.04); }
.panel-head { justify-content:space-between; gap:12px; margin-bottom:14px; }
.panel-head h2 { margin:0; font-size:18px; }
.panel-head > ion-icon { color:#7890bd; font-size:26px; }
.booking-start { display:grid; place-items:center; padding:28px 14px 22px; text-align:center; }
.booking-start h3 { margin:12px 0 6px; font-size:20px; }
.booking-start p { max-width:430px; margin:0 auto 16px; line-height:1.45; }
.start-icon { display:grid; place-items:center; width:58px; height:58px; border-radius:50%; color:#1954d1; background:#edf3ff; }
.start-icon ion-icon { font-size:31px; }
.start-actions { justify-content:center; flex-wrap:wrap; gap:10px; }
.select-driver-callout { justify-content:space-between; gap:12px; margin-bottom:14px; padding:12px; border:1px dashed #b8c8e5; border-radius:8px; background:#f5f8ff; }
.select-driver-callout p { margin:3px 0 0; font-size:12px; }
.selected-driver { gap:10px; margin-bottom:14px; padding:12px; border-radius:8px; background:#f5f7fb; }
.selected-driver img,.selected-driver span,.driver-row img,.driver-row span { width:42px; height:42px; border-radius:8px; object-fit:cover; }
.selected-driver span,.driver-row span { display:grid; place-items:center; color:#1954d1; background:#edf3ff; }
.selected-driver p { margin:3px 0 0; font-size:12px; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
label { display:grid; gap:6px; color:#53617a; font-size:12px; font-weight:850; }
.location-button { justify-self:start; display:inline-flex; align-items:center; gap:6px; padding:7px 9px; border:0; border-radius:7px; color:#1954d1; background:#edf3ff; font:inherit; font-size:11px; font-weight:900; cursor:pointer; }
.location-button ion-icon { font-size:16px; }
.wide,label:first-child { grid-column:1 / -1; }
input,select,textarea { width:100%; box-sizing:border-box; padding:11px; border:1px solid #d9e1ed; border-radius:8px; color:var(--ink); background:#fbfcfe; }
.trip-scope { display:grid; gap:8px; }
.trip-scope > span { color:#53617a; font-size:12px; font-weight:850; }
.scope-toggle { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:4px; border:1px solid #d9e1ed; border-radius:8px; background:#fbfcfe; }
.scope-toggle button { min-height:38px; border:0; border-radius:7px; color:#53617a; background:transparent; font-weight:900; cursor:pointer; }
.scope-toggle button.active { color:#fff; background:#1954d1; box-shadow:0 6px 16px rgba(25,84,209,.24); }
.route-warning { display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:center; margin-top:12px; padding:12px; border:1px solid #fed7aa; border-radius:8px; background:#fff7ed; color:#9a3412; }
.route-warning ion-icon { font-size:22px; color:#ea580c; }
.route-warning strong { display:block; font-size:12px; line-height:1.35; }
.route-warning p { margin:3px 0 0; color:#9a3412; font-size:11px; }
.route-suggestions { margin-top:10px; padding:8px 12px; border:1px solid #dbe7fb; border-radius:8px; background:#f8fbff; }
.empty.compact { padding:10px 0; font-size:12px; }
ion-button { margin-top:14px; }
.status-line { justify-content:space-between; gap:10px; }
.status-line span { padding:6px 8px; border-radius:8px; color:#12805c; background:#e9f8f2; font-size:11px; font-weight:900; text-transform:capitalize; }
.driver-row,.history-row { display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:center; width:100%; padding:12px 0; border:0; border-top:1px solid #edf1f6; background:transparent; text-align:left; cursor:pointer; }
.history-row { border-radius:8px; transition:background .16s ease, transform .16s ease; }
.history-row:hover,.history-row:focus-visible { padding-inline:10px; background:#f5f8ff; transform:translateY(-1px); outline:0; }
.driver-row.selected { padding-inline:10px; border-radius:8px; background:#edf3ff; }
.driver-row strong,.history-row strong { font-size:13px; }
.driver-row p,.history-row p { margin:3px 0 0; font-size:11px; }
.driver-row small,.history-row small { color:#667085; font-size:11px; text-align:right; text-transform:capitalize; }
.history-row span { display:grid; place-items:center; width:38px; height:38px; border-radius:8px; color:#1954d1; background:#edf3ff; }
.empty,.state { padding:18px 0; text-align:center; }
.error { color:#b91c1c; }
.success { color:#15803d; }
ion-modal { --height:72vh; --max-height:95vh; --border-radius:22px 22px 0 0; align-items:end; }
.booking-detail-sheet { display:flex; flex-direction:column; min-height:100%; padding:22px; overflow:auto; color:var(--ink); background:#fff; }
.modal-drag-grip { display:flex; justify-content:center; gap:4px; flex:0 0 auto; margin:-9px auto 14px; }
.modal-drag-grip span { width:22px; height:4px; border-radius:99px; background:#cbd5e1; }
.sheet-head { justify-content:space-between; gap:14px; margin-bottom:16px; }
.sheet-head h2 { margin:0 0 8px; font-size:22px; }
.sheet-status { display:inline-flex; padding:6px 9px; border-radius:8px; color:#12805c; background:#e9f8f2; font-size:11px; font-weight:900; text-transform:capitalize; }
.sheet-status.cancelled,.sheet-status.rejected { color:#b91c1c; background:#fee2e2; }
.sheet-status.requested { color:#805600; background:#fff4db; }
.sheet-status.accepted { color:#1954d1; background:#edf3ff; }
.sheet-status.started { color:#047857; background:#d1fae5; }
.sheet-status.arrived { color:#047857; background:#d1fae5; }
.modal-close { display:grid; place-items:center; width:40px; height:40px; border:0; border-radius:50%; color:#334155; background:#f1f5f9; cursor:pointer; }
.driver-summary { gap:12px; padding:12px; border:1px solid #e8edf5; border-radius:8px; background:#f8fbff; }
.driver-summary img,.driver-summary span { width:50px; height:50px; border-radius:8px; object-fit:cover; }
.driver-summary span { display:grid; place-items:center; color:#1954d1; background:#edf3ff; }
.driver-summary p { margin:3px 0 0; font-size:12px; }
.detail-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:14px 0; }
.detail-grid article { min-height:92px; padding:12px; border:1px solid #edf1f6; border-radius:8px; background:#fff; }
.detail-grid ion-icon { color:#7890bd; font-size:20px; }
.detail-grid span,.route-point span,.notes-card span { display:block; margin:8px 0 4px; color:#667085; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
.detail-grid strong { display:block; font-size:12px; line-height:1.3; }
.route-details { margin:2px 0 14px; padding:14px; border-radius:8px; background:#f5f7fb; }
.route-point { display:flex; align-items:flex-start; gap:10px; }
.route-point ion-icon { flex:0 0 auto; margin-top:2px; font-size:22px; }
.route-point.pickup ion-icon { color:#1954d1; }
.route-point.destination ion-icon { color:#12805c; }
.route-point strong { display:block; color:#26364f; line-height:1.45; }
.route-line { width:2px; height:28px; margin:4px 0 4px 10px; background:#d8e2f1; }
.notes-card { padding:13px; border:1px solid #edf1f6; border-radius:8px; background:#fff; }
.notes-card span { margin-top:0; }
.notes-card p { margin:0; line-height:1.45; }
.trip-timeline { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
.trip-timeline span { display:inline-flex; align-items:center; gap:5px; padding:7px 9px; border-radius:8px; color:#53617a; background:#f5f7fb; font-size:11px; font-weight:800; }
.trip-timeline ion-icon { color:#1954d1; font-size:15px; }
.sheet-actions { justify-content:flex-start; flex-wrap:wrap; gap:10px; position:sticky; bottom:-22px; margin:18px -22px -22px; padding:16px 22px 24px; border-top:1px solid #e8edf5; background:linear-gradient(#fff8,#fff 28%); }
@media (max-width:860px) { .booking-layout,.two-column { grid-template-columns:1fr; } }
@media (max-width:620px) { .page-shell { padding:17px 13px 92px; } .topbar { align-items:flex-start; flex-direction:column; } .form-grid { grid-template-columns:1fr; } .wide,label:first-child { grid-column:auto; } .select-driver-callout,.start-actions,.sheet-actions,.route-warning { align-items:stretch; grid-template-columns:1fr; flex-direction:column; } .detail-grid { grid-template-columns:repeat(2,1fr); } }
  `],
})
export class BookDriverPage implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly realtime = inject(RealtimeService);
  drivers: Driver[] = [];
  selectedDriver: Driver | null = null;
  currentBooking: Booking | null = null;
  history: Booking[] = [];
  selectedHistoryBooking: Booking | null = null;
  selectedRouteBooking: Booking | null = null;
  readonly interstateStates = INTERSTATE_STATES;
  historyModalOpen = false;
  routeModalOpen = false;
  showRouteSuggestions = false;
  showBookingForm = false;
  busy = false;
  dispatching = false;
  error = '';
  success = '';
  employerLocation: { latitude: number; longitude: number } | null = null;
  private refreshId?: number;
  form = {
    pickupAddress: '',
    destinationAddress: '',
    serviceType: 'chauffeur',
    urgency: 'standard',
    tripScope: 'local' as 'local' | 'interstate',
    routeState: '',
    dateTime: this.toLocalDateTime(new Date(Date.now() + 15 * 60 * 1000)),
    notes: '',
  };

  get hasRouteMismatch() {
    return Boolean(this.routeMismatchMessage);
  }

  get routeMismatchMessage() {
    if (this.form.tripScope !== 'interstate' || !this.form.routeState || !this.selectedDriver) return '';
    return this.driverCoversState(this.selectedDriver, this.form.routeState) ? '' : `${this.selectedDriver.name} is not available for selected route ${this.form.routeState}.`;
  }

  get suggestedRouteDrivers() {
    if (!this.form.routeState) return [];
    const selectedId = this.selectedDriver?.id;
    return this.drivers.filter((driver) => driver.id !== selectedId && this.driverCoversState(driver, this.form.routeState));
  }

  async ngOnInit() {
    this.restoreSelectedDriverFromRoute();
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 8000);
    this.restoreSelectedDriverFromRoute();
  }

  ngOnDestroy() { if (this.refreshId) window.clearInterval(this.refreshId); }

  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    if (showLoading) this.busy = true;
    this.error = '';
    try {
      const [dashboard, chauffeurs] = await Promise.all([
        this.api.get<DashboardResponse>('/employers/me/dashboard', token),
        this.api.get<ChauffeurResponse>('/employers/me/chauffeurs', token),
      ]);
      this.currentBooking = dashboard.currentBooking || null;
      this.history = dashboard.bookingHistory || [];
      this.drivers = chauffeurs.drivers || dashboard.nearbyChauffeurs || [];
      if (this.selectedDriver) this.selectedDriver = this.drivers.find((driver) => driver.id === this.selectedDriver?.id) || this.selectedDriver;
      if (this.success === 'Booking request submitted.' && this.currentBooking) {
        if (this.currentBooking.status === 'accepted') this.success = 'Booking accepted by chauffeur.';
        else if (this.currentBooking.status === 'started') this.success = 'Trip started. Your chauffeur is now live on route.';
        else if (this.currentBooking.status === 'arrived') this.success = 'Chauffeur has arrived at the pickup point.';
        else if (this.currentBooking.status === 'completed') this.success = 'Booking completed.';
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not load bookings';
    } finally {
      this.busy = false;
    }
  }

  selectDriver(driver: Driver) {
    this.selectedDriver = driver;
    this.showBookingForm = true;
    this.showRouteSuggestions = false;
  }

  private restoreSelectedDriverFromRoute() {
    const params = this.route.snapshot.queryParamMap;
    const selectedDriverId = params.get('driverId') || '';
    if (!selectedDriverId) return;
    const matchingDriver = this.drivers.find((driver) => String(driver.id) === selectedDriverId);
    this.selectedDriver = matchingDriver || {
      id: selectedDriverId,
      name: params.get('driverName') || 'Selected chauffeur',
      picture: params.get('driverPicture') || null,
      rating: null,
      distanceLabel: params.get('driverDistance') || 'Distance unavailable',
      experienceLevel: params.get('driverExperience') || 'Experience pending',
      safetyLevel: params.get('driverSafety') || 'Safety review pending',
      vehicleType: params.get('driverVehicle') || '',
      routeState: params.get('driverRouteState') || '',
      routeCoverageLabel: params.get('driverRouteCoverage') || '',
    };
    this.showBookingForm = true;
  }

  startNewBooking() {
    this.showBookingForm = true;
  }

  setTripScope(scope: 'local' | 'interstate') {
    this.form.tripScope = scope;
    if (scope === 'local') {
      this.form.routeState = '';
      this.showRouteSuggestions = false;
    }
  }

  onRouteStateChange() {
    this.showRouteSuggestions = Boolean(this.routeMismatchMessage);
  }

  async dispatch() {
    const token = this.auth.session()?.token;
    if (!token || !this.selectedDriver) return;
    if (this.hasRouteMismatch) {
      this.showRouteSuggestions = true;
      this.error = this.routeMismatchMessage;
      return;
    }
    this.dispatching = true;
    this.error = '';
    this.success = '';
    try {
      const routeNote = this.form.tripScope === 'interstate' && this.form.routeState ? `Inter-state route: ${this.form.routeState}` : '';
      await this.api.post('/bookings', {
        driverId: this.selectedDriver.id,
        date: new Date(this.form.dateTime).toISOString(),
        pickupLocation: { address: this.form.pickupAddress || 'Pickup location pending', latitude: this.employerLocation?.latitude, longitude: this.employerLocation?.longitude },
        destinationLocation: { address: this.form.destinationAddress || (this.form.tripScope === 'interstate' ? this.form.routeState : '') },
        urgency: this.form.urgency,
        serviceType: this.form.serviceType,
        notes: [routeNote, this.form.notes].filter(Boolean).join('\n'),
      }, token);
      this.success = 'Booking request submitted.';
      this.selectedDriver = null;
      this.showBookingForm = false;
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not request driver';
    } finally {
      this.dispatching = false;
    }
  }

  async captureEmployerLocation() {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      this.employerLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      this.success = 'Live pickup location captured and will be shared with the chauffeur.';
      this.error = '';
    } catch {
      this.error = 'Location permission is required to share your live pickup location.';
    }
  }

  async confirmDestination(booking: Booking) {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.dispatching = true;
    this.error = '';
    this.success = '';
    try {
      await this.api.patch(`/bookings/${booking.id}/confirm-destination`, {}, token);
      this.success = 'Destination confirmed. Booking completed.';
      await this.load();
      this.closeHistoryModal();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not confirm destination';
    } finally {
      this.dispatching = false;
    }
  }

  openRoute(booking: Booking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }

  openHistoryModal(booking: Booking) {
    this.selectedHistoryBooking = booking;
    this.historyModalOpen = true;
  }

  closeHistoryModal() {
    this.historyModalOpen = false;
    this.selectedHistoryBooking = null;
  }

  statusLabel(status: string) {
    const labels: Record<string, string> = {
      requested: 'Pending',
      accepted: 'Accepted',
      started: 'Live trip',
      arrived: 'Arrived',
      completed: 'Completed',
      cancelled: 'Canceled',
      canceled: 'Canceled',
      rejected: 'Canceled',
      postponed: 'Postponed',
      extended: 'Extended',
    };
    return labels[status] || status || 'Pending';
  }

  serviceLabel(value: string) {
    return value ? value.replace(/_/g, ' ') : 'chauffeur';
  }
  driverRouteSummary(driver: Driver) {
    const route = driver.routeCoverage?.find((item) => this.sameState(item.state, this.form.routeState));
    return route ? `${route.state} · ${route.routes}` : driver.routeCoverageLabel || driver.routeState || driver.route || 'Route coverage pending';
  }
  relativeBookingTime(booking: Booking) {
    return relativeTime(this.bookingActivityDate(booking));
  }
  exactEventTime(value: string | undefined, fallback: string) {
    return value ? new Date(value).toLocaleString() : fallback;
  }

  navigate(path: string) { void this.router.navigateByUrl(path); }
  back() { if (globalThis.history.length > 1) this.location.back(); else this.navigate('/employer/dashboard'); }

  private toLocalDateTime(date: Date) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }
  private bookingActivityDate(booking: Booking) {
    return booking.completedAt || booking.arrivedAt || booking.startedAt || booking.acceptedAt || booking.updatedAt || booking.createdAt;
  }

  private driverCoversState(driver: Driver, state: string) {
    if (!state) return true;
    if (this.sameState(driver.routeState, state)) return true;
    if ((driver.routeCoverage || []).some((route) => this.sameState(route.state, state) && (Number(route.years || 0) > 0 || Boolean(route.routes)))) return true;
    return this.sameState(driver.routeCoverageLabel, state) || this.sameState(driver.route, state);
  }

  private sameState(left = '', right = '') {
    const normalize = (value: string) => value.toLowerCase().replace(/[-_\s]+/g, '');
    return Boolean(left && right && normalize(left).includes(normalize(right)));
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
