import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { ToastController, IonButton, IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent, IonToggle } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { RealtimeService } from '../core/realtime.service';
import { RouteCoordinate } from '../shared/route-map.component';
import { RouteMapModalComponent } from '../shared/route-map-modal.component';

type BookingStatus = 'pending' | 'confirmed' | 'started' | 'arrived' | 'completed' | 'cancelled';
interface Booking { id: string; customerName: string; pickup: string; destination: string; notes?: string; time: string; amount: number | null; status: BookingStatus; routeUrl?: string; driverCoordinates?: RouteCoordinate; employerCoordinates?: RouteCoordinate; }
interface DriverProfile { id?: string; name: string; email?: string; phone?: string; avatar?: string | null; isOnline: boolean; verificationStatus: string; }
interface DashboardStats { todayBookings: number; bookingGrowth: number | null; todayEarnings: number | null; earningGrowth: number | null; totalTrips: number; rating: number | null; reviews: number; }
interface DriverLocation { name: string; city: string; latitude: number | null; longitude: number | null; }
interface DashboardResponse { driver: DriverProfile; dashboardStats: DashboardStats; currentLocation: DriverLocation; nextBooking: Booking | null; todaySchedule: Booking[]; recentActivities: { title: string; description: string; time: string; type: string; icon: string }[]; }

@Component({ standalone: true, imports: [CommonModule, IonButton, IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent, IonToggle, WorkspaceHeaderComponent, RouteMapModalComponent], templateUrl: './driver-dashboard.page.html', styleUrl: './driver-dashboard.page.scss' })
export class DriverDashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService); private readonly router = inject(Router); private readonly toast = inject(ToastController); private readonly realtime = inject(RealtimeService); readonly auth = inject(AuthService); readonly theme = inject(ThemeService); readonly fallbackAvatar = 'assets/driver-avatar.svg';
  driver: DriverProfile | null = null;
  dashboardStats: DashboardStats = this.defaultStats();
  currentLocation: DriverLocation = this.defaultLocation();
  nextBooking: Booking | null = null; todaySchedule: Booking[] = []; visibleSchedule: Booking[] = []; recentActivities: DashboardResponse['recentActivities'] = []; notificationCount = 0; loading = true; error = ''; selectedRouteBooking: Booking | null = null; routeModalOpen = false;
  private refreshId?: number;
  async ngOnInit() { this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.loadDashboard(false); }); await this.loadDashboard(); this.refreshId = window.setInterval(() => void this.loadDashboard(false), 12000); }
  ngOnDestroy() { if (this.refreshId) window.clearInterval(this.refreshId); }
  get isOnline() { return Boolean(this.driver?.isOnline); }
  async loadDashboard(showLoading = true) { const token = this.auth.session()?.token; if (!token) { void this.router.navigateByUrl('/login'); return; } if (showLoading) this.loading = true; this.error = ''; try { const data = await this.api.get<Partial<DashboardResponse>>('/drivers/me/dashboard', token); this.applyDashboard(data); } catch (e) { this.driver = null; this.error = e instanceof Error ? e.message : 'Could not load dashboard'; } finally { this.loading = false; } }
  async refresh(event: CustomEvent) { try { await this.loadDashboard(false); } finally { await (event.target as any)?.complete(); } }
  toggleTheme() { this.theme.toggleDriver(); }
  async toggleAvailability(event: { detail: { checked: boolean } }) { const token = this.auth.session()?.token; if (!token || !this.driver) return; const previous = this.driver.isOnline; const isOnline = event.detail.checked; this.driver = { ...this.driver, isOnline }; try { await this.api.patch('/drivers/me/availability', { isOnline }, token); await this.showToast(isOnline ? 'You are now online.' : 'You are now offline.'); } catch { this.driver = { ...this.driver, isOnline: previous }; await this.showToast('Availability could not be updated.'); } }
  async quickToggleOnline() { if (this.driver) await this.toggleAvailability({ detail: { checked: !this.driver.isOnline } }); }
  async shareLocation() { const token = this.auth.session()?.token; if (!token) return; try { const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true }); const location = { latitude: position.coords.latitude, longitude: position.coords.longitude }; await this.api.patch('/drivers/me/location', location, token); this.currentLocation = { ...location, name: 'Current position', city: 'Location sharing active' }; await this.showToast('Live location updated.'); } catch { await this.showToast('Location permission is unavailable.'); } }
  openBooking(booking: Booking) { void this.showToast(`${booking.customerName}: ${booking.pickup} → ${booking.destination}`); }
  async acceptBooking(booking: Booking) { await this.captureLocationForBooking(); await this.updateBooking(booking, 'accept', 'Booking accepted. Your live location is now shared with the employer.'); }
  async rejectBooking(booking: Booking) { await this.updateBooking(booking, 'reject', 'Booking rejected.'); }
  async startTrip(booking: Booking) { await this.captureLocationForBooking(); await this.updateBooking(booking, 'start', 'Trip started. Admin and employer can now track this as live.'); }
  async markArrived(booking: Booking) { await this.updateBooking(booking, 'arrived', 'Arrival marked. Waiting for employer confirmation.'); }
  private async captureLocationForBooking() {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      await this.api.patch('/drivers/me/location', { latitude: position.coords.latitude, longitude: position.coords.longitude }, token);
    } catch { /* Location permission failure does not block accepting the booking. */ }
  }
  openRoute(booking: Booking) { if (!booking.routeUrl && !booking.driverCoordinates && !booking.employerCoordinates) void this.showToast('Route will appear after driver and employer locations are available.'); this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }
  viewAllBookings() { void this.showToast('Booking history will appear here as trips are assigned.'); }
  openMap() { if (this.currentLocation.latitude !== null && this.currentLocation.longitude !== null) window.open(`https://www.google.com/maps?q=${this.currentLocation.latitude},${this.currentLocation.longitude}`, '_blank'); }
  handleQuickAction(action: { label: string }) { void this.showToast(`${action.label} is coming next in the driver workspace.`); }
  navigate(route: string) { void this.router.navigateByUrl(route); }
  logout() { this.auth.logout(); }
  private applyDashboard(data: Partial<DashboardResponse>) {
    const sessionUser = this.auth.session()?.user;
    if (!data.driver) throw new Error('Driver profile not found for this account.');
    this.driver = {
      id: data.driver.id || sessionUser?.id,
      name: data.driver.name || sessionUser?.name || 'Driver',
      email: data.driver.email || sessionUser?.email,
      phone: data.driver.phone || sessionUser?.phone,
      avatar: data.driver.avatar ?? null,
      isOnline: Boolean(data.driver.isOnline),
      verificationStatus: data.driver.verificationStatus || 'pending',
    };
    this.dashboardStats = { ...this.defaultStats(), ...data.dashboardStats };
    this.currentLocation = { ...this.defaultLocation(), ...data.currentLocation };
    this.nextBooking = data.nextBooking ?? null;
    this.todaySchedule = Array.isArray(data.todaySchedule) ? data.todaySchedule : [];
    this.visibleSchedule = this.todaySchedule.slice(0, 5);
    this.recentActivities = Array.isArray(data.recentActivities) ? data.recentActivities : [];
    this.notificationCount = this.todaySchedule.filter((booking) => booking.status === 'pending').length + (this.nextBooking ? 1 : 0) + 1;
  }
  private async updateBooking(booking: Booking, action: 'accept' | 'reject' | 'start' | 'arrived', message: string) {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      await this.api.patch(`/bookings/${booking.id}/${action}`, {}, token);
      await this.showToast(message);
      await this.loadDashboard(false);
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : 'Booking update failed.');
    }
  }
  private defaultStats(): DashboardStats { return { todayBookings: 0, bookingGrowth: null, todayEarnings: null, earningGrowth: null, totalTrips: 0, rating: null, reviews: 0 }; }
  private defaultLocation(): DriverLocation { return { name: 'Location pending', city: 'Waiting for live update', latitude: null, longitude: null }; }
  private async showToast(message: string) { const overlay = await this.toast.create({ message, duration: 1800, position: 'top' }); await overlay.present(); }
}
