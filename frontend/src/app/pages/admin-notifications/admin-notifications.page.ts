import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminNavComponent } from '../admin-nav.component';
type AdminNotification = { id: string; type: string; title: string; body: string; read: boolean };
import { WorkspaceHeaderComponent } from '../workspace-header.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent],
  templateUrl: './admin-notifications.page.html',
  styleUrl: './admin-notifications.page.scss'
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
