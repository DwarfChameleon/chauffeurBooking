import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminNavComponent } from '../admin-nav.component';
import { AdminDriver } from '../admin-types';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar, AdminNavComponent, WorkspaceHeaderComponent],
  templateUrl: './admin-drivers.page.html',
  styleUrl: './admin-drivers.page.scss'
})
export class AdminDriversPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  drivers: AdminDriver[] = [];
  query = '';
  loading = false;
  error = '';

  get filteredDrivers() {
    const value = this.query.trim().toLowerCase();
    if (!value) return this.drivers;
    return this.drivers.filter((driver) => [driver.name, driver.email, driver.phone, driver.currentState, driver.vehicle?.type, driver.vehicle?.model].some((item) => String(item || '').toLowerCase().includes(value)));
  }

  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.loading = true;
    this.error = '';
    try {
      this.drivers = await this.api.get<AdminDriver[]>('/admin/drivers', token);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load drivers';
    } finally {
      this.loading = false;
    }
  }

  async setAvailability(driver: AdminDriver, isAvailable: boolean) {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (driver.isActiveTrip) {
      this.error = 'Driver is active on a live trip. Complete the trip before changing availability.';
      return;
    }
    try {
      const result = await this.api.patch<{ driver: AdminDriver }>(`/admin/drivers/${driver._id}/availability`, { isAvailable }, token);
      Object.assign(driver, result.driver);
    } catch (error) {
      driver.isAvailable = !isAvailable;
      this.error = error instanceof Error ? error.message : 'Could not update availability';
    }
  }

  async deleteDriver(driver: AdminDriver) {
    if (driver.isActiveTrip) {
      this.error = 'Driver is active on a live trip. Complete the trip before deleting this driver.';
      return;
    }
    if (!window.confirm(`Delete ${driver.name || 'this driver'}?`)) return;
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      await this.api.delete('/admin/drivers/' + driver._id, token);
      this.drivers = this.drivers.filter((item) => item._id !== driver._id);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not delete driver';
    }
  }
}
