import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminNavComponent } from './admin-nav.component';
import { AdminDriver } from './admin-types';
import { adminPageStyles } from './admin-users.page';
import { WorkspaceHeaderComponent } from './workspace-header.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar, AdminNavComponent, WorkspaceHeaderComponent],
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Drivers" [showBack]="true" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <p class="eyebrow">Chauffeur supply</p><h1>Driver control</h1>
      <ion-searchbar placeholder="Search driver, state or vehicle" (ionInput)="query = $any($event.target).value || ''"></ion-searchbar>
      <p class="state error" *ngIf="error">{{ error }}</p>
      <section class="list-panel">
        <article class="driver-card" [class.live-trip]="driver.isActiveTrip" *ngFor="let driver of filteredDrivers">
          <div class="avatar green"><img *ngIf="driver.profilePicture; else icon" [src]="driver.profilePicture" alt=""><ng-template #icon><ion-icon name="car-sport-outline"></ion-icon></ng-template></div>
          <div class="body">
            <strong>{{ driver.name || 'Unnamed chauffeur' }}</strong>
            <small>{{ driver.email || driver.phone || 'No contact' }} • {{ driver.currentState || 'State not set' }}</small>
            <span>{{ driver.readinessScore || 0 }}% readiness</span>
            <span class="driver-status active" *ngIf="driver.isActiveTrip">active</span>
          </div>
          <div class="controls">
            <label class="switch" [class.disabled]="driver.isActiveTrip" [title]="driver.isActiveTrip ? 'Driver is on a live trip' : 'Toggle availability'"><input type="checkbox" [checked]="driver.isAvailable" [disabled]="driver.isActiveTrip" (change)="setAvailability(driver, $any($event.target).checked)"><b></b></label>
            <button class="danger" type="button" [disabled]="driver.isActiveTrip" [title]="driver.isActiveTrip ? 'Complete the live trip before deleting' : 'Delete driver'" (click)="deleteDriver(driver)"><ion-icon name="trash-outline"></ion-icon></button>
          </div>
        </article>
        <p class="empty" *ngIf="!loading && !filteredDrivers.length">No drivers found.</p>
      </section>
    </main>
  </ion-content>
  <app-admin-nav active="drivers"></app-admin-nav>
</div>
  `,
  styles: [adminPageStyles() + `
.switch { width:48px; height:28px; position:relative; display:inline-block; }
.switch input { display:none; }
.switch b { position:absolute; inset:0; border-radius:999px; background:#cbd5e1; cursor:pointer; transition:.2s ease; }
.switch b::after { content:""; position:absolute; width:22px; height:22px; top:3px; left:3px; border-radius:50%; background:#fff; box-shadow:0 2px 8px rgba(15,23,42,.25); transition:.2s ease; }
.switch input:checked + b { background:#16a34a; }
.switch input:checked + b::after { transform:translateX(20px); }
.driver-card.live-trip { border-color:rgba(22,163,74,.35); background:linear-gradient(180deg,#fff,#f3fff8); }
.driver-status.active { display:inline-flex; align-items:center; width:max-content; margin-top:6px; padding:5px 8px; border-radius:8px; color:#047857; background:#d1fae5; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.04em; }
.switch.disabled { opacity:.55; cursor:not-allowed; }
.switch.disabled b { cursor:not-allowed; }
button:disabled { opacity:.45; cursor:not-allowed; filter:grayscale(.25); }
`],
})
export class AdminDriversPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  drivers: AdminDriver[] = [];
  query = '';
  loading = false;
  error = '';

  get filteredDrivers() {
    const value = this.query.trim().toLowerCase();
    if (!value) return this.drivers;
    return this.drivers.filter((driver) => [driver.name, driver.email, driver.phone, driver.currentState, driver.vehicle?.type, driver.vehicle?.model].some((item) => String(item || '').toLowerCase().includes(value)));
  }

  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.loading = true;
    this.error = '';
    try {
      this.drivers = await this.api.get<AdminDriver[]>('/admin/drivers', token);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load drivers';
    } finally {
      this.loading = false;
    }
  }

  async setAvailability(driver: AdminDriver, isAvailable: boolean) {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (driver.isActiveTrip) {
      this.error = 'Driver is active on a live trip. Complete the trip before changing availability.';
      return;
    }
    try {
      const result = await this.api.patch<{ driver: AdminDriver }>(`/admin/drivers/${driver._id}/availability`, { isAvailable }, token);
      Object.assign(driver, result.driver);
    } catch (error) {
      driver.isAvailable = !isAvailable;
      this.error = error instanceof Error ? error.message : 'Could not update availability';
    }
  }

  async deleteDriver(driver: AdminDriver) {
    if (driver.isActiveTrip) {
      this.error = 'Driver is active on a live trip. Complete the trip before deleting this driver.';
      return;
    }
    if (!window.confirm(`Delete ${driver.name || 'this driver'}?`)) return;
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      await this.api.delete('/admin/drivers/' + driver._id, token);
      this.drivers = this.drivers.filter((item) => item._id !== driver._id);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not delete driver';
    }
  }
}
