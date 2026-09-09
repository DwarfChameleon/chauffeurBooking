import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminNavComponent } from '../admin-nav.component';
import { AdminDriver, AdminUser, DocumentStatus, DRIVER_DOCUMENTS, DriverDocumentKey, EMPLOYER_DOCUMENTS, EmployerDocumentKey } from '../admin-types';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent],
  templateUrl: './admin-verification.page.html',
  styleUrl: './admin-verification.page.scss'
})
export class AdminVerificationPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  drivers: AdminDriver[] = [];
  employers: AdminUser[] = [];
  loading = false;
  error = '';
  driverDocs = DRIVER_DOCUMENTS;
  employerDocs = EMPLOYER_DOCUMENTS;

  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.loading = true;
    this.error = '';
    try {
      const [drivers, users] = await Promise.all([this.api.get<AdminDriver[]>('/admin/drivers', token), this.api.get<AdminUser[]>('/admin/users', token)]);
      this.drivers = drivers;
      this.employers = users.filter((user) => user.role === 'user');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load verification queue';
    } finally {
      this.loading = false;
    }
  }

  async updateDriver(driver: AdminDriver, key: DriverDocumentKey, status: DocumentStatus) {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      const result = await this.api.patch<{ driver: AdminDriver }>(`/admin/drivers/${driver._id}/documents/${key}`, { status }, token);
      Object.assign(driver, result.driver);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not update driver document';
    }
  }

  async updateEmployer(employer: AdminUser, key: EmployerDocumentKey, status: DocumentStatus) {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      const result = await this.api.patch<{ user: AdminUser }>(`/admin/users/${employer._id}/employer-documents/${key}`, { status }, token);
      Object.assign(employer, result.user);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not update employer document';
    }
  }
}
