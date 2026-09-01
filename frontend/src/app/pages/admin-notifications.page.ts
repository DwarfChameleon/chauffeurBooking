import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminNavComponent } from './admin-nav.component';
type AdminNotification = { id: string; type: string; title: string; body: string; read: boolean };
import { adminPageStyles } from './admin-users.page';
import { WorkspaceHeaderComponent } from './workspace-header.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent],
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Notifications" [showBack]="true" [notificationCount]="notices.length" (backRequested)="back()" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <p class="eyebrow">Admin alerts</p><h1>Notifications</h1>
      <p class="state error" *ngIf="error">{{ error }}</p>
      <section class="list-panel">
        <button class="notice-card" *ngFor="let notice of notices" type="button" (click)="open(notice)">
          <div class="avatar amber"><ion-icon [name]="noticeIcon(notice.type)"></ion-icon></div>
          <div class="body"><strong>{{ notice.title }}</strong><small>{{ notice.body }}</small><span>{{ notice.type }}</span></div>
        </button>
        <p class="empty" *ngIf="!loading && !notices.length">No admin notifications right now.</p>
      </section>
    </main>
    <ion-modal [isOpen]="!!selected" [initialBreakpoint]="0.48" [breakpoints]="[0,0.48,0.85]" (didDismiss)="selected = null">
      <ng-template>
        <main class="notice-sheet">
          <button class="modal-close" type="button" (click)="selected = null"><ion-icon name="close-outline"></ion-icon></button>
          <p class="eyebrow">{{ selected?.type }}</p>
          <h2>{{ selected?.title }}</h2>
          <p>{{ selected?.body }}</p>
        </main>
      </ng-template>
    </ion-modal>
  </ion-content>
  <app-admin-nav active="dashboard"></app-admin-nav>
</div>
  `,
  styles: [adminPageStyles() + `
.notice-card { width:100%; border:1px solid var(--admin-line,#dbe5f2); cursor:pointer; text-align:left; }
.notice-sheet { min-height:100%; padding:18px; color:var(--admin-text,#101828); background:var(--admin-card,#fff); }
.notice-sheet h2 { margin:7px 0 8px; }
.notice-sheet p:not(.eyebrow) { color:var(--admin-muted,#667085); line-height:1.55; }
.modal-close { float:right; width:40px; height:40px; border:0; border-radius:50%; display:grid; place-items:center; color:#1954d1; background:rgba(25,84,209,.1); }
:host-context(body.dark-theme) .notice-sheet { --admin-card:#0d1420; --admin-text:#f8fafc; --admin-muted:#b7c0cf; }
`],
})
export class AdminNotificationsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly location = inject(Location);
  notices: AdminNotification[] = [];
  selected: AdminNotification | null = null;
  loading = false;
  error = '';

  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.loading = true;
    this.error = '';
    try {
      const data = await this.api.get<{ notifications: AdminNotification[] }>('/notifications', token);
      this.notices = data.notifications || [];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load notifications';
    } finally {
      this.loading = false;
    }
  }

  back() { if (window.history.length > 1) this.location.back(); }
  open(notice: AdminNotification) {
    this.selected = notice;
    if (!notice.read) {
      notice.read = true;
      const token = this.auth.session()?.token;
      if (token) void this.api.patch(`/notifications/${notice.id}/read`, {}, token);
    }
  }
  noticeIcon(type: string) { return type === 'booking' ? 'calendar-outline' : type === 'verification' ? 'shield-checkmark-outline' : 'speedometer-outline'; }
}
