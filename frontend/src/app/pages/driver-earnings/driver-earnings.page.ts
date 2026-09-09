import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

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
  templateUrl: './driver-earnings.page.html',
  styleUrl: './driver-earnings.page.scss'
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
