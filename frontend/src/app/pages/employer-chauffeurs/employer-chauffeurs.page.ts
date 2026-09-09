import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EmployerNavComponent } from '../employer-nav.component';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

type Chauffeur = {
  id: string; name: string; picture: string | null; rating: number | null; route: string; routeState: string;
  routeCoverage?: { state: string; routes: string; years: number; isCurrent: boolean }[]; routeCoverageLabel?: string;
  distanceLabel: string; experienceLevel: string; readinessScore: number; safetyLevel: string; accidentCount: number;
  yearsOfExperience: number; completedTrips: number; vehicleType: string; transmission: string; verificationStatus: string;
};
type EmployerProfileResponse = { profile: { employerProfile: { state: string; latitude: number | null; longitude: number | null } }; stateOptions: string[] };
type ChauffeurResponse = { state: string; drivers: Chauffeur[]; count: number };

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent],
  templateUrl: './employer-chauffeurs.page.html',
  styleUrl: './employer-chauffeurs.page.scss'
})
export class EmployerChauffeursPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly auth = inject(AuthService);
  drivers: Chauffeur[] = [];
  stateOptions = ['Bayelsa', 'Delta', 'Benin', 'Rivers', 'Calabar', 'Abia', 'Akwa Ibom', 'Edo', 'Abuja', 'Lagos'];
  selectedState = '';
  employerCoordinates: { latitude: number; longitude: number } | null = null;
  loading = true;
  error = '';
  private refreshId?: number;

  async ngOnInit() {
    await this.loadProfileAndDrivers();
    this.refreshId = window.setInterval(() => void this.loadDrivers(false), 12000);
  }

  ngOnDestroy() {
    if (this.refreshId) window.clearInterval(this.refreshId);
  }

  async refresh(event: CustomEvent) { try { await this.loadDrivers(false); } finally { await (event.target as any)?.complete(); } }

  async loadProfileAndDrivers() {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    try {
      const profile = await this.api.get<EmployerProfileResponse>('/employers/me/profile', token);
      this.selectedState = profile.profile.employerProfile.state || '';
      this.stateOptions = profile.stateOptions || this.stateOptions;
      const { latitude, longitude } = profile.profile.employerProfile;
      if (latitude !== null && longitude !== null) this.employerCoordinates = { latitude, longitude };
      await this.loadDrivers();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load chauffeur directory';
      this.loading = false;
    }
  }

  async loadDrivers(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      const coordinates = this.employerCoordinates;
      const params = new URLSearchParams();
      if (this.selectedState) params.set('state', this.selectedState);
      if (coordinates) {
        params.set('latitude', String(coordinates.latitude));
        params.set('longitude', String(coordinates.longitude));
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await this.api.get<ChauffeurResponse>(`/employers/me/chauffeurs${suffix}`, token);
      this.drivers = data.drivers || [];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load available chauffeurs';
    } finally {
      this.loading = false;
    }
  }

  captureLocation() {
    if (!navigator.geolocation) { this.error = 'Location is not available in this browser.'; return; }
    navigator.geolocation.getCurrentPosition((position) => {
      this.employerCoordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      void this.loadDrivers();
    }, () => { this.error = 'Location permission was not granted.'; }, { enableHighAccuracy: true, timeout: 8000 });
  }

  requestDriver(driver: Chauffeur) {
    void this.router.navigate(['/book-driver'], {
      queryParams: {
        driverId: String(driver.id),
        driverName: driver.name,
        driverPicture: driver.picture || '',
        driverDistance: driver.distanceLabel || '',
        driverExperience: driver.experienceLevel || '',
        driverSafety: driver.safetyLevel || '',
        driverVehicle: driver.vehicleType || '',
        driverRouteState: driver.routeState || '',
        driverRouteCoverage: driver.routeCoverageLabel || '',
      },
    });
  }

  formatVehicle(value: string) {
    return value ? value.replace(/_/g, ' ') : '';
  }

  back() { if (globalThis.history.length > 1) this.location.back(); else void this.router.navigateByUrl('/employer/dashboard'); }
}
