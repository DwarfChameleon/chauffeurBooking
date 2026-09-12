import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { AdminBooking, AdminCallLog } from '../admin-types';
import { AdminNavComponent } from '../admin-nav.component';
import { WorkspaceHeaderComponent } from '../workspace-header.component';
import { ADMIN_CALL_OPTIONS, AdminCallTarget } from '../admin-bookings/admin-bookings.props';
import { AdminCallHistoryResponse, CALL_STATUS_LABELS, LIVE_ROUTE_STATUSES } from './admin-callcenter.props';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent],
  templateUrl: './admin-callcenter.page.html',
  styleUrl: './admin-callcenter.page.scss',
})
export class AdminCallcenterPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly subscription = new Subscription();
  private refreshId?: number;

  readonly callOptions = ADMIN_CALL_OPTIONS;
  readonly statusLabels = CALL_STATUS_LABELS;
  liveBookings: AdminBooking[] = [];
  callHistory: AdminCallLog[] = [];
  loading = false;
  error = '';
  callMessage = '';
  busyBookingId = '';

  get activeCalls() {
    return this.callHistory.filter((call) => call.status === 'active' || call.status === 'ringing');
  }

  get callsToday() {
    const today = new Date().toDateString();
    return this.callHistory.filter((call) => new Date(call.createdAt || '').toDateString() === today).length;
  }

  get averageDuration() {
    const endedCalls = this.callHistory.filter((call) => call.durationSeconds > 0);
    if (!endedCalls.length) return '0:00';
    const total = endedCalls.reduce((sum, call) => sum + call.durationSeconds, 0);
    return this.formatDuration(Math.round(total / endedCalls.length));
  }

  async ngOnInit() {
    this.subscription.add(this.realtime.events$.subscribe((event) => {
      if (event.kind === 'booking') void this.loadLiveBookings(false);
      if (event.kind === 'call-log-updated') this.upsertCall(event.call);
    }));
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 15000);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.refreshId) window.clearInterval(this.refreshId);
  }

  async refresh(event: CustomEvent) {
    try {
      await this.load(false);
    } finally {
      await (event.target as any)?.complete?.();
    }
  }

  async load(showLoading = true) {
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      await Promise.all([this.loadLiveBookings(false), this.loadCallHistory(false)]);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load callcenter data';
    } finally {
      this.loading = false;
    }
  }

  async loadLiveBookings(showError = true) {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      const bookings = await this.api.get<AdminBooking[]>('/admin/bookings', token);
      this.liveBookings = bookings.filter((booking) => LIVE_ROUTE_STATUSES.has(booking.status));
    } catch (error) {
      if (showError) this.error = error instanceof Error ? error.message : 'Could not load live bookings';
      throw error;
    }
  }

  async loadCallHistory(showError = true) {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      const response = await this.api.get<AdminCallHistoryResponse>('/calls/history', token);
      this.callHistory = response.calls || [];
    } catch (error) {
      if (showError) this.error = error instanceof Error ? error.message : 'Could not load call history';
      throw error;
    }
  }

  async startCall(booking: AdminBooking, target: AdminCallTarget) {
    if (this.busyBookingId) return;
    this.busyBookingId = booking.id;
    this.callMessage = '';
    this.error = '';
    try {
      const response = await this.realtime.initiateBookingCall(booking.id, target);
      this.callMessage = response.message || 'Selected participant is ringing.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not start call';
    } finally {
      this.busyBookingId = '';
    }
  }

  displayDate(value?: string) {
    return value ? new Date(value).toLocaleString() : 'Not recorded';
  }

  contactLine(booking: AdminBooking) {
    return [booking.driverPhone || booking.driverEmail, booking.employerPhone || booking.employerEmail].filter(Boolean).join(' | ') || 'No contact saved';
  }

  participantSummary(call: AdminCallLog) {
    return call.participants.map((participant) => participant.name || participant.label || participant.role).filter(Boolean).join(', ') || 'No participant snapshot';
  }

  formatDuration(seconds = 0) {
    const safeSeconds = Math.max(0, seconds || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }

  private upsertCall(call: AdminCallLog) {
    const index = this.callHistory.findIndex((item) => item.id === call.id || item.callSessionId === call.callSessionId);
    if (index >= 0) this.callHistory = [call, ...this.callHistory.slice(0, index), ...this.callHistory.slice(index + 1)];
    else this.callHistory = [call, ...this.callHistory];
  }
}
