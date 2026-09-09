import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { Geolocation } from '@capacitor/geolocation';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { EmployerNavComponent } from '../employer-nav.component';
import { WorkspaceHeaderComponent } from '../workspace-header.component';
import { RouteCoordinate } from '../../shared/route-map.component';
import { RouteMapModalComponent } from '../../shared/route-map-modal.component';

type RouteCoverage = { state: string; routes: string; years: number; isCurrent: boolean };
type Driver = { id: string; name: string; picture: string | null; rating: number | null; distanceLabel: string; experienceLevel: string; safetyLevel: string; vehicleType: string; route?: string; routeState?: string; routeCoverage?: RouteCoverage[]; routeCoverageLabel?: string };
type Booking = { id: string; driverName: string; driverPicture?: string | null; serviceType: string; urgency: string; status: string; pickupAddress: string; destinationAddress?: string; displayDate: string; displayTime: string; notes?: string; routeUrl?: string; driverCoordinates?: RouteCoordinate; employerCoordinates?: RouteCoordinate; acceptedAt?: string; startedAt?: string; arrivedAt?: string; completedAt?: string; createdAt?: string; updatedAt?: string };
type DashboardResponse = { currentBooking: Booking | null; bookingHistory: Booking[]; nearbyChauffeurs: Driver[] };
type ChauffeurResponse = { drivers: Driver[] };
const INTERSTATE_STATES = ['Bayelsa', 'Delta', 'Benin', 'Rivers', 'Calabar', 'Abia', 'Akwa Ibom', 'Edo', 'Abuja', 'Lagos'];

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent, RouteMapModalComponent],
  templateUrl: './book-driver.page.html',
  styleUrl: './book-driver.page.scss'
})
export class BookDriverPage implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly realtime = inject(RealtimeService);
  drivers: Driver[] = [];
  selectedDriver: Driver | null = null;
  currentBooking: Booking | null = null;
  history: Booking[] = [];
  selectedHistoryBooking: Booking | null = null;
  selectedRouteBooking: Booking | null = null;
  readonly interstateStates = INTERSTATE_STATES;
  historyModalOpen = false;
  routeModalOpen = false;
  showRouteSuggestions = false;
  showBookingForm = false;
  busy = false;
  dispatching = false;
  error = '';
  success = '';
  employerLocation: { latitude: number; longitude: number } | null = null;
  private refreshId?: number;
  form = {
    pickupAddress: '',
    destinationAddress: '',
    serviceType: 'chauffeur',
    urgency: 'standard',
    tripScope: 'local' as 'local' | 'interstate',
    routeState: '',
    dateTime: this.toLocalDateTime(new Date(Date.now() + 15 * 60 * 1000)),
    notes: '',
  };

  get hasRouteMismatch() {
    return Boolean(this.routeMismatchMessage);
  }

  get routeMismatchMessage() {
    if (this.form.tripScope !== 'interstate' || !this.form.routeState || !this.selectedDriver) return '';
    return this.driverCoversState(this.selectedDriver, this.form.routeState) ? '' : `${this.selectedDriver.name} is not available for selected route ${this.form.routeState}.`;
  }

  get suggestedRouteDrivers() {
    if (!this.form.routeState) return [];
    const selectedId = this.selectedDriver?.id;
    return this.drivers.filter((driver) => driver.id !== selectedId && this.driverCoversState(driver, this.form.routeState));
  }

  async ngOnInit() {
    this.restoreSelectedDriverFromRoute();
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 8000);
    this.restoreSelectedDriverFromRoute();
  }

  ngOnDestroy() { if (this.refreshId) window.clearInterval(this.refreshId); }

  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    if (showLoading) this.busy = true;
    this.error = '';
    try {
      const [dashboard, chauffeurs] = await Promise.all([
        this.api.get<DashboardResponse>('/employers/me/dashboard', token),
        this.api.get<ChauffeurResponse>('/employers/me/chauffeurs', token),
      ]);
      this.currentBooking = dashboard.currentBooking || null;
      this.history = dashboard.bookingHistory || [];
      this.drivers = chauffeurs.drivers || dashboard.nearbyChauffeurs || [];
      if (this.selectedDriver) this.selectedDriver = this.drivers.find((driver) => driver.id === this.selectedDriver?.id) || this.selectedDriver;
      if (this.success === 'Booking request submitted.' && this.currentBooking) {
        if (this.currentBooking.status === 'accepted') this.success = 'Booking accepted by chauffeur.';
        else if (this.currentBooking.status === 'started') this.success = 'Trip started. Your chauffeur is now live on route.';
        else if (this.currentBooking.status === 'arrived') this.success = 'Chauffeur has arrived at the pickup point.';
        else if (this.currentBooking.status === 'completed') this.success = 'Booking completed.';
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not load bookings';
    } finally {
      this.busy = false;
    }
  }

  selectDriver(driver: Driver) {
    this.selectedDriver = driver;
    this.showBookingForm = true;
    this.showRouteSuggestions = false;
  }

  private restoreSelectedDriverFromRoute() {
    const params = this.route.snapshot.queryParamMap;
    const selectedDriverId = params.get('driverId') || '';
    if (!selectedDriverId) return;
    const matchingDriver = this.drivers.find((driver) => String(driver.id) === selectedDriverId);
    this.selectedDriver = matchingDriver || {
      id: selectedDriverId,
      name: params.get('driverName') || 'Selected chauffeur',
      picture: params.get('driverPicture') || null,
      rating: null,
      distanceLabel: params.get('driverDistance') || 'Distance unavailable',
      experienceLevel: params.get('driverExperience') || 'Experience pending',
      safetyLevel: params.get('driverSafety') || 'Safety review pending',
      vehicleType: params.get('driverVehicle') || '',
      routeState: params.get('driverRouteState') || '',
      routeCoverageLabel: params.get('driverRouteCoverage') || '',
    };
    this.showBookingForm = true;
  }

  startNewBooking() {
    this.showBookingForm = true;
  }

  setTripScope(scope: 'local' | 'interstate') {
    this.form.tripScope = scope;
    if (scope === 'local') {
      this.form.routeState = '';
      this.showRouteSuggestions = false;
    }
  }

  onRouteStateChange() {
    this.showRouteSuggestions = Boolean(this.routeMismatchMessage);
  }

  async dispatch() {
    const token = this.auth.session()?.token;
    if (!token || !this.selectedDriver) return;
    if (this.hasRouteMismatch) {
      this.showRouteSuggestions = true;
      this.error = this.routeMismatchMessage;
      return;
    }
    this.dispatching = true;
    this.error = '';
    this.success = '';
    try {
      const routeNote = this.form.tripScope === 'interstate' && this.form.routeState ? `Inter-state route: ${this.form.routeState}` : '';
      await this.api.post('/bookings', {
        driverId: this.selectedDriver.id,
        date: new Date(this.form.dateTime).toISOString(),
        pickupLocation: { address: this.form.pickupAddress || 'Pickup location pending', latitude: this.employerLocation?.latitude, longitude: this.employerLocation?.longitude },
        destinationLocation: { address: this.form.destinationAddress || (this.form.tripScope === 'interstate' ? this.form.routeState : '') },
        urgency: this.form.urgency,
        serviceType: this.form.serviceType,
        notes: [routeNote, this.form.notes].filter(Boolean).join('\n'),
      }, token);
      this.success = 'Booking request submitted.';
      this.selectedDriver = null;
      this.showBookingForm = false;
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not request driver';
    } finally {
      this.dispatching = false;
    }
  }

  async captureEmployerLocation() {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      this.employerLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      this.success = 'Live pickup location captured and will be shared with the chauffeur.';
      this.error = '';
    } catch {
      this.error = 'Location permission is required to share your live pickup location.';
    }
  }

  async confirmDestination(booking: Booking) {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.dispatching = true;
    this.error = '';
    this.success = '';
    try {
      await this.api.patch(`/bookings/${booking.id}/confirm-destination`, {}, token);
      this.success = 'Destination confirmed. Booking completed.';
      await this.load();
      this.closeHistoryModal();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not confirm destination';
    } finally {
      this.dispatching = false;
    }
  }

  openRoute(booking: Booking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }

  openHistoryModal(booking: Booking) {
    this.selectedHistoryBooking = booking;
    this.historyModalOpen = true;
  }

  closeHistoryModal() {
    this.historyModalOpen = false;
    this.selectedHistoryBooking = null;
  }

  statusLabel(status: string) {
    const labels: Record<string, string> = {
      requested: 'Pending',
      accepted: 'Accepted',
      started: 'Live trip',
      arrived: 'Arrived',
      completed: 'Completed',
      cancelled: 'Canceled',
      canceled: 'Canceled',
      rejected: 'Canceled',
      postponed: 'Postponed',
      extended: 'Extended',
    };
    return labels[status] || status || 'Pending';
  }

  serviceLabel(value: string) {
    return value ? value.replace(/_/g, ' ') : 'chauffeur';
  }
  driverRouteSummary(driver: Driver) {
    const route = driver.routeCoverage?.find((item) => this.sameState(item.state, this.form.routeState));
    return route ? `${route.state} · ${route.routes}` : driver.routeCoverageLabel || driver.routeState || driver.route || 'Route coverage pending';
  }
  relativeBookingTime(booking: Booking) {
    return relativeTime(this.bookingActivityDate(booking));
  }
  exactEventTime(value: string | undefined, fallback: string) {
    return value ? new Date(value).toLocaleString() : fallback;
  }

  navigate(path: string) { void this.router.navigateByUrl(path); }
  back() { if (globalThis.history.length > 1) this.location.back(); else this.navigate('/employer/dashboard'); }

  private toLocalDateTime(date: Date) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }
  private bookingActivityDate(booking: Booking) {
    return booking.completedAt || booking.arrivedAt || booking.startedAt || booking.acceptedAt || booking.updatedAt || booking.createdAt;
  }

  private driverCoversState(driver: Driver, state: string) {
    if (!state) return true;
    if (this.sameState(driver.routeState, state)) return true;
    if ((driver.routeCoverage || []).some((route) => this.sameState(route.state, state) && (Number(route.years || 0) > 0 || Boolean(route.routes)))) return true;
    return this.sameState(driver.routeCoverageLabel, state) || this.sameState(driver.route, state);
  }

  private sameState(left = '', right = '') {
    const normalize = (value: string) => value.toLowerCase().replace(/[-_\s]+/g, '');
    return Boolean(left && right && normalize(left).includes(normalize(right)));
  }
}

function relativeTime(value?: string) {
  if (!value) return 'Just now';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Just now';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  const units: [number, string][] = [[2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'min']];
  for (const [unitSeconds, label] of units) {
    const count = Math.floor(seconds / unitSeconds);
    if (count >= 1) return `${count} ${label}${count === 1 ? '' : 's'} ago`;
  }
  return `${seconds} sec${seconds === 1 ? '' : 's'} ago`;
}
