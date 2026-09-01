import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { EmployerNavComponent } from './employer-nav.component';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { RealtimeService } from '../core/realtime.service';

type Notice = { id?: string; icon: string; title: string; message: string; time: string; tone: 'blue' | 'green' | 'orange' | 'purple'; read?: boolean };

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonFooter, IonIcon, IonModal, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent],
  template: `
<div class="ion-page" [class.driver-page]="role === 'driver'" [class.employer-page]="role === 'employer'">
  <app-workspace-header [role]="role" title="Notifications" [notificationCount]="unreadCount" [showBack]="true" (backRequested)="goBack()" (refreshRequested)="load(false)"></app-workspace-header>
  <ion-content [class.driver-workspace]="role === 'driver'">
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="notification-shell">
      <section class="page-intro">
        <p class="eyebrow">{{ role }} alerts</p>
        <h1>Notification center</h1>
        <span>{{ notices.length }} recent update{{ notices.length === 1 ? '' : 's' }}</span>
      </section>

      <p class="state error" *ngIf="error">{{ error }}</p>
      <p class="state" *ngIf="loading">Loading notifications...</p>

      <section class="notice-list" *ngIf="!loading">
        <button class="notice-card" *ngFor="let notice of notices; let index = index" [ngClass]="notice.tone" type="button" (click)="openNotice(notice, index)" [attr.aria-label]="'Read ' + notice.title">
          <div class="notice-icon"><ion-icon [name]="notice.icon"></ion-icon></div>
          <div>
            <h2>{{ notice.title }}</h2>
            <p>{{ notice.message }}</p>
            <small>{{ notice.time }}</small>
          </div>
        </button>
        <article class="empty" *ngIf="notices.length === 0">
          <ion-icon name="notifications-off-outline"></ion-icon>
          <h2>No notifications yet</h2>
          <p>New booking, route, verification, and account updates will appear here.</p>
        </article>
      </section>
    </main>
  </ion-content>

  <ion-modal [isOpen]="noticeModalOpen" [initialBreakpoint]="0.52" [breakpoints]="[0, 0.52, 0.9]" handle="true" handleBehavior="drag" (didDismiss)="closeNotice()">
    <ng-template>
      <section class="notice-detail" *ngIf="selectedNotice as notice">
        <header class="notice-detail-head"><div class="notice-icon" [ngClass]="notice.tone"><ion-icon [name]="notice.icon"></ion-icon></div><button type="button" class="modal-close" (click)="closeNotice()" aria-label="Close notification"><ion-icon name="close-outline"></ion-icon></button></header>
        <p class="eyebrow">{{ role }} notification</p>
        <h2>{{ notice.title }}</h2>
        <p>{{ notice.message }}</p>
        <small>{{ notice.time }}</small>
      </section>
    </ng-template>
  </ion-modal>

  <app-employer-nav *ngIf="role === 'employer'" active="dashboard"></app-employer-nav>
  <ion-footer *ngIf="role === 'driver'" class="driver-bottom-nav">
    <div class="bottom-nav">
      <button class="nav-item" (click)="navigate('/driver/dashboard')"><ion-icon name="grid-outline"></ion-icon><span>Dashboard</span></button>
      <button class="nav-item" (click)="navigate('/driver/bookings')"><ion-icon name="calendar-outline"></ion-icon><span>Bookings</span></button>
      <button class="nav-item availability-nav" (click)="navigate('/driver/dashboard')"><div><ion-icon name="power-outline"></ion-icon></div><span>Status</span></button>
      <button class="nav-item" (click)="navigate('/driver/earnings')"><ion-icon name="bar-chart-outline"></ion-icon><span>Earnings</span></button>
      <button class="nav-item" (click)="navigate('/driver/profile')"><ion-icon name="person-circle-outline"></ion-icon><span>Profile</span></button>
    </div>
  </ion-footer>
</div>
  `,
  styles: [`
:host { display:block; --ink:#172033; --muted:#667085; --line:#e6ebf2; --blue:#1954d1; --green:#12805c; }
.notification-shell { max-width:900px; margin:0 auto; padding:18px 16px 94px; }
.page-intro { margin-bottom:14px; }
.eyebrow { margin:0 0 5px; color:#5571a7; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
h1,h2,p { margin-top:0; }
h1 { margin-bottom:4px; font-size:24px; }
.page-intro span,.state,.empty p { color:var(--muted); }
.notice-list { display:grid; gap:12px; }
.notice-card,.empty { display:grid; grid-template-columns:auto 1fr; gap:12px; padding:15px; border:1px solid var(--line); border-radius:10px; background:#fff; box-shadow:0 8px 22px rgba(20,32,61,.05); }
.notice-card { width:100%; text-align:left; font:inherit; cursor:pointer; }
.notice-card h2 { margin:0 0 5px; color:var(--ink); font-size:15px; }
.notice-card p { margin:0 0 7px; color:#475569; font-size:13px; line-height:1.45; }
.notice-card small { color:var(--muted); font-size:11px; font-weight:800; }
.notice-icon { width:40px; height:40px; display:grid; place-items:center; border-radius:10px; background:#edf3ff; color:var(--blue); }
.notice-icon ion-icon { font-size:21px; }
.notice-card.green .notice-icon { color:#12805c; background:#e9f8f2; }
.notice-card.orange .notice-icon { color:#b45309; background:#fff4db; }
.notice-card.purple .notice-icon { color:#7c3aed; background:#f4efff; }
.empty { grid-template-columns:1fr; justify-items:center; text-align:center; padding:34px 18px; }
.empty ion-icon { color:#96abd3; font-size:42px; }
.error { color:#b42318; }
.driver-page .notification-shell { color:#f8fafc; }
.driver-page .page-intro h1,.driver-page .notice-card h2,.driver-page .empty h2 { color:#f8fafc; }
.driver-page .notice-card,.driver-page .empty { background:linear-gradient(150deg,#111a29,#0b111b); border-color:rgba(255,255,255,.1); box-shadow:none; }
.driver-page .notice-card p,.driver-page .notice-card small,.driver-page .page-intro span,.driver-page .state,.driver-page .empty p { color:#cbd5e1; }
body.driver-light-theme .driver-page .page-intro h1,
body.driver-light-theme .driver-page .notice-card h2,
body.driver-light-theme .driver-page .empty h2 { color:#172033; }
body.driver-light-theme .driver-page .notice-card,
body.driver-light-theme .driver-page .empty { background:#fff; border-color:#dbe5f2; box-shadow:0 8px 22px rgba(20,32,61,.06); }
body.driver-light-theme .driver-page .notice-card p,
body.driver-light-theme .driver-page .notice-card small,
body.driver-light-theme .driver-page .page-intro span,
body.driver-light-theme .driver-page .state,
body.driver-light-theme .driver-page .empty p { color:#64748b; }
.driver-bottom-nav { background:rgba(8,13,21,.96); backdrop-filter:blur(20px); border-top:1px solid rgba(255,255,255,.08); padding-bottom:env(safe-area-inset-bottom); }
.bottom-nav { max-width:700px; margin:auto; display:grid; grid-template-columns:repeat(5,1fr); align-items:center; min-height:70px; }
.nav-item { border:0; background:transparent; color:#cbd5e1; display:flex; flex-direction:column; align-items:center; gap:5px; font:inherit; font-size:10px; }
.nav-item ion-icon { color:currentColor; font-size:22px; }
.availability-nav div { width:50px; height:50px; margin-top:-30px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; box-shadow:0 10px 30px rgba(124,58,237,.4); }
.notice-detail { min-height:280px; padding:22px 20px 34px; color:#172033; }
.notice-detail-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; }
.notice-detail h2 { margin:0 0 8px; font-size:22px; }
.notice-detail p:not(.eyebrow) { color:#475569; line-height:1.55; }
.notice-detail small { color:#64748b; font-weight:800; }
.modal-close { width:38px; height:38px; border:0; border-radius:50%; background:#edf3ff; color:#1954d1; display:grid; place-items:center; }
.modal-close ion-icon { font-size:21px; }
  `],
})
export class NotificationsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  role: 'driver' | 'employer' = 'employer';
  notices: Notice[] = [];
  selectedNotice: Notice | null = null;
  noticeModalOpen = false;
  loading = true;
  error = '';

  get unreadCount() { return this.notices.filter((notice) => !notice.read).length; }

  async ngOnInit() {
    this.role = this.router.url.includes('/driver/') ? 'driver' : 'employer';
    this.realtime.events$.subscribe((event) => {
      if (event.kind === 'notification') void this.load(false);
      if (event.kind === 'booking') void this.load(false);
    });
    await this.load();
  }

  async refresh(event: CustomEvent) { try { await this.load(false); } finally { await (event.target as any)?.complete(); } }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      const data = await this.api.get<any>('/notifications', token);
      this.notices = (data.notifications || []).map((notice: any) => ({
        icon: notice.type === 'booking' ? 'calendar-outline' : notice.type === 'verification' ? 'shield-checkmark-outline' : 'information-circle-outline',
        title: notice.title,
        message: notice.body,
        time: notice.createdAt ? new Date(notice.createdAt).toLocaleString() : 'Recent',
        tone: notice.type === 'booking' ? 'blue' : notice.type === 'verification' ? 'purple' : 'green',
        id: notice.id,
        read: notice.read,
      }));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load notifications';
    } finally {
      this.loading = false;
    }
  }

  navigate(path: string) { void this.router.navigateByUrl(path); }

  goBack() {
    if (window.history.length > 1) this.location.back();
    else this.navigate(this.role === 'driver' ? '/driver/dashboard' : '/employer/dashboard');
  }

  openNotice(notice: Notice, index: number) {
    if (notice.id && !notice.read) {
      notice.read = true;
      const token = this.auth.session()?.token;
      if (token) void this.api.patch(`/notifications/${notice.id}/read`, {}, token);
    }
    this.selectedNotice = notice;
    this.noticeModalOpen = true;
  }

  closeNotice() {
    this.noticeModalOpen = false;
    this.selectedNotice = null;
  }

  private async driverNotices(token: string): Promise<Notice[]> {
    const data = await this.api.get<any>('/drivers/me/dashboard', token);
    const pending = (data.todaySchedule || []).filter((booking: any) => booking.status === 'pending');
    const current = data.nextBooking;
    return [
      ...pending.map((booking: any) => ({ icon: 'calendar-outline', title: 'New booking request', message: `${booking.customerName} needs pickup from ${booking.pickup}.`, time: booking.time || 'Today', tone: 'orange' as const })),
      ...(current ? [{ icon: 'navigate-outline', title: 'Current route update', message: `${current.pickup} → ${current.destination}`, time: current.time || 'Now', tone: 'blue' as const }] : []),
      { icon: 'shield-checkmark-outline', title: 'Profile readiness', message: `Your verification status is ${data.driver?.verificationStatus || 'pending'}.`, time: 'Live', tone: 'purple' as const },
    ];
  }

  private async employerNotices(token: string): Promise<Notice[]> {
    const data = await this.api.get<any>('/employers/me/dashboard', token);
    const active = data.currentBooking;
    const history = (data.bookingHistory || []).slice(0, 3);
    return [
      ...(active ? [{ icon: 'briefcase-outline', title: 'Active booking', message: `${active.driverName} is assigned to ${active.pickupAddress}. Status: ${active.status}.`, time: active.displayTime || 'Now', tone: 'blue' as const }] : []),
      ...history.map((booking: any) => ({ icon: 'calendar-outline', title: 'Booking update', message: `${booking.driverName} · ${booking.status}`, time: booking.displayTime || booking.displayDate || 'Recent', tone: booking.status === 'completed' ? 'green' as const : 'purple' as const })),
      { icon: 'car-sport-outline', title: 'Chauffeur availability', message: `${data.stats?.availableChauffeurs || 0} chauffeurs are currently available near your selected state.`, time: 'Live', tone: 'green' as const },
    ];
  }
}
