import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EmployerNavComponent } from '../employer-nav.component';
import { WorkspaceHeaderComponent } from '../workspace-header.component';
import { RealtimeService } from '../../core/realtime.service';

type Notice = { id?: string; icon: string; title: string; message: string; time: string; tone: 'blue' | 'green' | 'orange' | 'purple'; read?: boolean };

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonFooter, IonIcon, IonModal, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss'
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
