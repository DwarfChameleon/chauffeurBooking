import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { WorkspaceHeaderComponent } from './workspace-header.component';

type EarningsResponse = {
  summary?: {
    completedTrips: number;
    todayBookings: number;
    upcomingBookings: number;
    totalBookings: number;
    todayEarnings: number | null;
    totalEarnings: number | null;
  };
  serviceBreakdown?: Record<string, number>;
  message?: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent, WorkspaceHeaderComponent],
  template: `
<div class="ion-page driver-page">
  <app-workspace-header role="driver" title="Earnings" (refreshRequested)="load()"></app-workspace-header>
  <ion-content class="driver-workspace">
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="workspace-shell">
      <section class="workspace-header page-intro"><div><p class="eyebrow">Driver Workspace</p><h1>Earnings</h1><p>Track trip volume now. Fare totals will appear when payments are added.</p></div></section>

      <section class="earnings-hero">
        <div>
          <span>Today</span>
          <strong>{{ money(summary.todayEarnings) }}</strong>
          <p>{{ message }}</p>
        </div>
        <div>
          <span>Total</span>
          <strong>{{ money(summary.totalEarnings) }}</strong>
          <p>{{ summary.completedTrips }} completed trips</p>
        </div>
      </section>

      <section class="summary-grid">
        <article><span>Bookings Today</span><strong>{{ summary.todayBookings }}</strong></article>
        <article><span>Upcoming</span><strong>{{ summary.upcomingBookings }}</strong></article>
        <article><span>Total Bookings</span><strong>{{ summary.totalBookings }}</strong></article>
        <article><span>Completed</span><strong>{{ summary.completedTrips }}</strong></article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">SERVICE MIX</p>
            <h2>Work by Category</h2>
          </div>
        </div>

        <p class="state" *ngIf="loading">Loading earnings...</p>
        <p class="state error" *ngIf="error">{{ error }}</p>
        <p class="state" *ngIf="!loading && !error && serviceEntries.length === 0">No completed or assigned work yet.</p>

        <article class="service-row" *ngFor="let service of serviceEntries">
          <div><ion-icon name="briefcase-outline"></ion-icon></div>
          <span>{{ label(service.key) }}</span>
          <strong>{{ service.value }}</strong>
        </article>
      </section>
    </main>
  </ion-content>

  <ion-footer class="driver-bottom-nav">
    <div class="bottom-nav">
      <button class="nav-item" (click)="navigate('/driver/dashboard')"><ion-icon name="grid-outline"></ion-icon><span>Dashboard</span></button>
      <button class="nav-item" (click)="navigate('/driver/bookings')"><ion-icon name="calendar-outline"></ion-icon><span>Bookings</span></button>
      <button class="nav-item availability-nav" (click)="navigate('/driver/dashboard')"><div><ion-icon name="power-outline"></ion-icon></div><span>Status</span></button>
      <button class="nav-item active" (click)="navigate('/driver/earnings')"><ion-icon name="bar-chart-outline"></ion-icon><span>Earnings</span></button>
      <button class="nav-item" (click)="navigate('/driver/profile')"><ion-icon name="person-circle-outline"></ion-icon><span>Profile</span></button>
    </div>
  </ion-footer>
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
.earnings-hero { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; }
.earnings-hero > div,.summary-grid article,.panel { background:linear-gradient(150deg,#111a29,#0b111b); border:1px solid var(--border-color); border-radius:18px; padding:18px; }
.earnings-hero span,.summary-grid span { color:#cbd5e1; display:block; font-size:12px; margin-bottom:8px; }
.earnings-hero strong { color:#f8fafc; display:block; font-size:34px; line-height:1.1; margin-bottom:8px; }
.earnings-hero p { color:#cbd5e1; margin:0; font-size:13px; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
.summary-grid strong { color:#f8fafc; display:block; font-size:26px; }
.panel-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
.panel-header h2 { color:#f8fafc; margin:0; font-size:18px; }
.service-row { display:grid; grid-template-columns:38px 1fr auto; gap:12px; align-items:center; padding:14px 0; border-bottom:1px solid rgba(255,255,255,.07); }
.service-row:last-child { border-bottom:0; }
.service-row div { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; color:#bbf7d0; background:rgba(34,197,94,.16); }
.service-row span,.service-row strong { color:#f8fafc; }
.state { color:#cbd5e1; padding:24px 0; text-align:center; }
.error { color:#fecaca; }
.driver-bottom-nav { background:rgba(8,13,21,.96); backdrop-filter:blur(20px); border-top:1px solid rgba(255,255,255,.08); padding-bottom:env(safe-area-inset-bottom); }
.bottom-nav { max-width:700px; margin:auto; display:grid; grid-template-columns:repeat(5,1fr); align-items:center; min-height:70px; }
.nav-item { border:0; background:transparent; color:#cbd5e1; display:flex; flex-direction:column; align-items:center; gap:5px; font-size:10px; }
.nav-item ion-icon { color:currentColor; font-size:22px; }
.nav-item.active { color:#d8b4fe; }
.availability-nav div { width:50px; height:50px; margin-top:-30px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; box-shadow:0 10px 30px rgba(124,58,237,.4); }
@media (max-width:650px) { .workspace-header { align-items:flex-start; flex-direction:column; } .earnings-hero,.summary-grid { grid-template-columns:repeat(2,1fr); } .earnings-hero strong { font-size:27px; } }
  `],
})
export class DriverEarningsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  summary = { completedTrips: 0, todayBookings: 0, upcomingBookings: 0, totalBookings: 0, todayEarnings: null as number | null, totalEarnings: null as number | null };
  serviceBreakdown: Record<string, number> = {};
  message = 'Earnings will show once fare/payment tracking is added to bookings.';
  loading = true;
  error = '';

  get serviceEntries() { return Object.entries(this.serviceBreakdown).map(([key, value]) => ({ key, value })); }
  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }
  async load() {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.get<EarningsResponse>('/drivers/me/earnings', token);
      this.summary = { ...this.summary, ...result.summary };
      this.serviceBreakdown = result.serviceBreakdown || {};
      this.message = result.message || this.message;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load earnings';
    } finally {
      this.loading = false;
    }
  }
  money(value: number | null) { return value === null ? 'Not tracked yet' : `NGN ${value.toLocaleString()}`; }
  label(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
  navigate(route: string) { void this.router.navigateByUrl(route); }
  logout() { this.auth.logout(); }
}
