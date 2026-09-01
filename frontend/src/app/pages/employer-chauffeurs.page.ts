import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { EmployerNavComponent } from './employer-nav.component';
import { WorkspaceHeaderComponent } from './workspace-header.component';

type Chauffeur = {
  id: string; name: string; picture: string | null; rating: number | null; route: string; routeState: string;
  routeCoverage?: { state: string; routes: string; years: number; isCurrent: boolean }[]; routeCoverageLabel?: string;
  distanceLabel: string; experienceLevel: string; readinessScore: number; safetyLevel: string; accidentCount: number;
  yearsOfExperience: number; completedTrips: number; vehicleType: string; transmission: string; verificationStatus: string;
};
type EmployerProfileResponse = { profile: { employerProfile: { state: string; latitude: number | null; longitude: number | null } }; stateOptions: string[] };
type ChauffeurResponse = { state: string; drivers: Chauffeur[]; count: number };

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent],
  template: `
<div class="employer-page">
  <app-workspace-header role="employer" title="Chauffeurs" (refreshRequested)="loadDrivers(false)"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="page-shell">
      <section class="page-intro">
        <div>
          <p class="eyebrow">Chauffeur directory</p>
          <h1>Available chauffeurs</h1>
          <span>Drivers are ranked by distance, route experience, safety and verification.</span>
        </div>
      </section>

      <section class="filter-panel">
        <label>Employer state
          <select [(ngModel)]="selectedState" (ngModelChange)="loadDrivers()">
            <option value="">All supported states</option>
            <option *ngFor="let state of stateOptions" [value]="state">{{ state }}</option>
          </select>
        </label>
        <button class="ghost-button" type="button" (click)="captureLocation()"><ion-icon name="locate-outline"></ion-icon> Use my location</button>
        <div class="result-count"><strong>{{ drivers.length }}</strong><span>available</span></div>
      </section>

      <p class="state error" *ngIf="error">{{ error }}</p>
      <div class="loading-state" *ngIf="loading">Finding chauffeurs near you...</div>

      <section class="driver-grid" *ngIf="!loading">
        <article class="driver-card" *ngFor="let driver of drivers">
          <div class="driver-head">
            <img *ngIf="driver.picture; else driverFallback" [src]="driver.picture" [alt]="driver.name">
            <ng-template #driverFallback><span class="driver-fallback"><ion-icon name="person-circle-outline"></ion-icon></span></ng-template>
            <div>
              <h2>{{ driver.name }}</h2>
              <p><ion-icon name="navigate-outline"></ion-icon>{{ driver.distanceLabel }}</p>
            </div>
            <span class="badge" [class.verified]="driver.verificationStatus === 'verified'"><ion-icon [name]="driver.verificationStatus === 'verified' ? 'checkmark-circle' : 'time-outline'"></ion-icon>{{ driver.verificationStatus === 'verified' ? 'Verified' : 'Review' }}</span>
          </div>

          <div class="route-box">
            <span><ion-icon name="map-outline"></ion-icon> Route coverage</span>
            <strong>{{ driver.routeCoverageLabel || driver.routeState || selectedState || 'Regional' }}</strong>
            <small>{{ driver.route || 'Route pending' }}</small>
            <div class="route-chip-grid" *ngIf="driver.routeCoverage?.length; else routePending">
              <div class="route-chip" *ngFor="let coverage of driver.routeCoverage" [class.current]="coverage.isCurrent">
                <b>{{ coverage.state }}</b>
                <em>{{ coverage.years }} yr{{ coverage.years === 1 ? '' : 's' }}</em>
                <small>{{ coverage.routes }}</small>
              </div>
            </div>
            <ng-template #routePending><p class="route-empty">No accepted route states set yet.</p></ng-template>
          </div>

          <div class="score-grid">
            <div><ion-icon name="star"></ion-icon><strong>{{ driver.rating === null ? 'New' : (driver.rating | number:'1.1-1') }}</strong><span>Rating</span></div>
            <div><ion-icon name="ribbon-outline"></ion-icon><strong>{{ driver.experienceLevel }}</strong><span>{{ driver.yearsOfExperience }} yrs</span></div>
            <div><ion-icon name="shield-checkmark-outline"></ion-icon><strong>{{ driver.safetyLevel }}</strong><span>{{ driver.accidentCount }} accident{{ driver.accidentCount === 1 ? '' : 's' }}</span></div>
            <div><ion-icon name="git-branch-outline"></ion-icon><strong>{{ driver.readinessScore }}%</strong><span>Readiness</span></div>
          </div>

          <div class="driver-foot">
            <span><ion-icon name="car-outline"></ion-icon>{{ formatVehicle(driver.vehicleType) }}</span>
            <span><ion-icon name="speedometer-outline"></ion-icon>{{ formatVehicle(driver.transmission) || 'Transmission pending' }}</span>
            <span><ion-icon name="checkmark-circle-outline"></ion-icon>{{ driver.completedTrips }} trips</span>
          </div>

          <button class="primary-button" type="button" (click)="requestDriver(driver)"><ion-icon name="calendar-outline"></ion-icon> Request chauffeur</button>
        </article>

        <article class="empty" *ngIf="drivers.length === 0">
          <ion-icon name="car-outline"></ion-icon>
          <h2>No available chauffeurs found</h2>
          <p>Ask chauffeurs to go online and update their current operating state or route experience.</p>
        </article>
      </section>
    </main>
  </ion-content>
  <app-employer-nav active="chauffeurs"></app-employer-nav>
</div>
  `,
  styles: [`
:host { display:block; --ink:#172033; --muted:#667085; --line:#e6ebf2; --blue:#1954d1; --green:#12805c; --red:#b42318; }
.employer-page { min-height:100%; background:#f7f9fc; color:var(--ink); }
.page-shell { max-width:1160px; margin:0 auto; padding:22px 18px 92px; }
.page-intro,.filter-panel,.driver-head,.driver-foot { display:flex; align-items:center; }
.page-intro { justify-content:space-between; gap:14px; margin-bottom:16px; }
.page-intro h1 { margin:0 0 4px; font-size:25px; line-height:1.12; }
.page-intro span,.driver-head p,.driver-foot,.empty p { color:var(--muted); }
.eyebrow { margin:0 0 5px; color:#5571a7; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
button,select { font:inherit; }
.icon-button,.ghost-button,.primary-button { border:0; border-radius:8px; cursor:pointer; font-weight:850; }
.icon-button { display:grid; place-items:center; width:38px; height:38px; flex:0 0 auto; color:var(--blue); background:#eaf1ff; }
.ghost-button,.primary-button { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:38px; padding:0 12px; color:var(--blue); background:#edf3ff; }
.primary-button { width:100%; color:#fff; background:var(--blue); }
.filter-panel { justify-content:space-between; gap:12px; margin-bottom:15px; padding:14px; border:1px solid var(--line); border-radius:8px; background:#fff; }
label { display:grid; gap:6px; min-width:240px; color:#53617a; font-size:12px; font-weight:850; }
select { width:100%; padding:11px; border:1px solid #d9e1ed; border-radius:8px; color:var(--ink); background:#fbfcfe; }
.result-count { margin-left:auto; text-align:right; }
.result-count strong { display:block; font-size:24px; }
.result-count span { color:var(--muted); font-size:11px; font-weight:800; text-transform:uppercase; }
.driver-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.driver-card,.empty { border:1px solid var(--line); border-radius:8px; background:#fff; box-shadow:0 8px 22px rgba(20,32,61,.04); }
.driver-card { padding:16px; }
.driver-head { gap:11px; }
.driver-head img,.driver-fallback { width:54px; height:54px; border-radius:8px; object-fit:cover; }
.driver-fallback { display:grid; place-items:center; color:#1954d1; background:#edf3ff; }
.driver-fallback ion-icon { font-size:34px; }
.driver-head h2 { margin:0 0 5px; font-size:16px; }
.driver-head p { display:flex; align-items:center; gap:4px; margin:0; font-size:12px; }
.badge { display:inline-flex; align-items:center; gap:4px; margin-left:auto; padding:6px 8px; border-radius:8px; color:#805600; background:#fff4db; font-size:10px; font-weight:900; }
.badge.verified { color:#12805c; background:#e9f8f2; }
.route-box { display:grid; gap:4px; margin:15px 0; padding:12px; border-radius:8px; background:#f5f7fb; }
.route-box span { display:flex; align-items:center; gap:5px; color:#667085; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
.route-box strong { color:#26364f; font-size:13px; line-height:1.4; }
.route-box small { color:var(--muted); }
.route-chip-grid { display:grid; gap:8px; margin-top:8px; }
.route-chip { display:grid; grid-template-columns:auto auto; gap:3px 7px; padding:9px; border:1px solid #dbe7fb; border-radius:8px; background:#fff; }
.route-chip.current { border-color:#bda7ff; background:#f5f0ff; }
.route-chip b { color:#1954d1; font-size:12px; }
.route-chip em { justify-self:end; align-self:center; color:#12805c; font-size:10px; font-style:normal; font-weight:900; }
.route-chip small { grid-column:1 / -1; color:#53617a; font-size:11px; line-height:1.35; }
.route-empty { margin:8px 0 0; color:var(--muted); font-size:12px; }
.score-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.score-grid div { min-height:82px; padding:10px; border:1px solid #edf1f6; border-radius:8px; background:#fff; }
.score-grid ion-icon { color:#7890bd; font-size:18px; }
.score-grid strong { display:block; margin-top:6px; font-size:12px; line-height:1.2; }
.score-grid span { display:block; margin-top:4px; color:var(--muted); font-size:10px; }
.driver-foot { flex-wrap:wrap; gap:9px; margin:14px 0; font-size:11px; }
.driver-foot span { display:inline-flex; align-items:center; gap:4px; }
.empty,.loading-state,.state { padding:36px 18px; text-align:center; color:var(--muted); }
.empty { grid-column:1 / -1; }
.empty ion-icon { color:#96abd3; font-size:42px; }
.empty h2 { color:var(--ink); font-size:19px; }
.error { color:var(--red); }
@media (max-width:880px) { .driver-grid { grid-template-columns:1fr; } .score-grid { grid-template-columns:repeat(2,1fr); } }
@media (max-width:620px) { .page-shell { padding:17px 13px 92px; } .page-intro,.filter-panel { align-items:flex-start; flex-direction:column; } label { min-width:0; width:100%; } .result-count { margin-left:0; text-align:left; } }
  `],
})
export class EmployerChauffeursPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly auth = inject(AuthService);
  drivers: Chauffeur[] = [];
  stateOptions = ['Bayelsa', 'Delta', 'Benin', 'Rivers', 'Calabar', 'Abia', 'Akwa Ibom', 'Edo', 'Abuja', 'Lagos'];
  selectedState = '';
  employerCoordinates: { latitude: number; longitude: number } | null = null;
  loading = true;
  error = '';
  private refreshId?: number;

  async ngOnInit() {
    await this.loadProfileAndDrivers();
    this.refreshId = window.setInterval(() => void this.loadDrivers(false), 12000);
  }

  ngOnDestroy() {
    if (this.refreshId) window.clearInterval(this.refreshId);
  }

  async refresh(event: CustomEvent) { try { await this.loadDrivers(false); } finally { await (event.target as any)?.complete(); } }

  async loadProfileAndDrivers() {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    try {
      const profile = await this.api.get<EmployerProfileResponse>('/employers/me/profile', token);
      this.selectedState = profile.profile.employerProfile.state || '';
      this.stateOptions = profile.stateOptions || this.stateOptions;
      const { latitude, longitude } = profile.profile.employerProfile;
      if (latitude !== null && longitude !== null) this.employerCoordinates = { latitude, longitude };
      await this.loadDrivers();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load chauffeur directory';
      this.loading = false;
    }
  }

  async loadDrivers(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      const coordinates = this.employerCoordinates;
      const params = new URLSearchParams();
      if (this.selectedState) params.set('state', this.selectedState);
      if (coordinates) {
        params.set('latitude', String(coordinates.latitude));
        params.set('longitude', String(coordinates.longitude));
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await this.api.get<ChauffeurResponse>(`/employers/me/chauffeurs${suffix}`, token);
      this.drivers = data.drivers || [];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load available chauffeurs';
    } finally {
      this.loading = false;
    }
  }

  captureLocation() {
    if (!navigator.geolocation) { this.error = 'Location is not available in this browser.'; return; }
    navigator.geolocation.getCurrentPosition((position) => {
      this.employerCoordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      void this.loadDrivers();
    }, () => { this.error = 'Location permission was not granted.'; }, { enableHighAccuracy: true, timeout: 8000 });
  }

  requestDriver(driver: Chauffeur) {
    void this.router.navigate(['/book-driver'], {
      queryParams: {
        driverId: String(driver.id),
        driverName: driver.name,
        driverPicture: driver.picture || '',
        driverDistance: driver.distanceLabel || '',
        driverExperience: driver.experienceLevel || '',
        driverSafety: driver.safetyLevel || '',
        driverVehicle: driver.vehicleType || '',
        driverRouteState: driver.routeState || '',
        driverRouteCoverage: driver.routeCoverageLabel || '',
      },
    });
  }

  formatVehicle(value: string) {
    return value ? value.replace(/_/g, ' ') : '';
  }

  back() { if (globalThis.history.length > 1) this.location.back(); else void this.router.navigateByUrl('/employer/dashboard'); }
}
