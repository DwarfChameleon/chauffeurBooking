import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminNavComponent } from './admin-nav.component';
import { AdminDriver, AdminUser, DocumentStatus, DRIVER_DOCUMENTS, DriverDocumentKey, EMPLOYER_DOCUMENTS, EmployerDocumentKey } from './admin-types';
import { adminPageStyles } from './admin-users.page';
import { WorkspaceHeaderComponent } from './workspace-header.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent],
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Verification" [showBack]="true" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <p class="eyebrow">Trust and safety</p><h1>Document verification</h1>
      <p class="state error" *ngIf="error">{{ error }}</p>

      <section class="list-panel">
        <article class="verify-card" *ngFor="let driver of drivers">
          <div class="avatar green"><ion-icon name="car-sport-outline"></ion-icon></div>
          <div class="body"><strong>{{ driver.name || 'Unnamed chauffeur' }}</strong><small>{{ driver.email || driver.phone || 'No contact' }}</small></div>
          <div class="doc-grid">
            <div class="doc-control" *ngFor="let doc of driverDocs">
              <span><ion-icon [name]="doc.icon"></ion-icon>{{ doc.label }}</span>
              <a *ngIf="driver.documents?.[doc.key]?.reference" [href]="driver.documents?.[doc.key]?.reference" target="_blank" rel="noreferrer">View</a>
              <select [value]="driver.documents?.[doc.key]?.status || 'missing'" (change)="updateDriver(driver, doc.key, $any($event.target).value)">
                <option value="missing">Missing</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </article>

        <article class="verify-card" *ngFor="let employer of employers">
          <div class="avatar purple"><ion-icon name="business-outline"></ion-icon></div>
          <div class="body"><strong>{{ employer.employerProfile?.companyName || employer.name || 'Unnamed employer' }}</strong><small>{{ employer.email || employer.phone || 'No contact' }}</small></div>
          <div class="doc-grid employer-doc-grid">
            <div class="doc-control" *ngFor="let doc of employerDocs">
              <span><ion-icon [name]="doc.icon"></ion-icon>{{ doc.label }}</span>
              <a *ngIf="employer.employerProfile?.documents?.[doc.key]?.reference" [href]="employer.employerProfile?.documents?.[doc.key]?.reference" target="_blank" rel="noreferrer">View</a>
              <select [value]="employer.employerProfile?.documents?.[doc.key]?.status || 'missing'" (change)="updateEmployer(employer, doc.key, $any($event.target).value)">
                <option value="missing">Missing</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </article>
        <p class="empty" *ngIf="!loading && !drivers.length && !employers.length">No documents in review yet.</p>
      </section>
    </main>
  </ion-content>
  <app-admin-nav active="verification"></app-admin-nav>
</div>
  `,
  styles: [adminPageStyles() + `
.verify-card { align-items:flex-start; flex-wrap:wrap; }
.doc-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; flex:1 0 100%; }
.employer-doc-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
.doc-control { display:grid; gap:8px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; padding:10px; }
.doc-control span { display:flex; align-items:center; gap:7px; color:var(--admin-text,#101828); font-size:12px; font-weight:900; }
.doc-control span ion-icon { color:#1954d1; font-size:19px; }
.doc-control a { color:#1954d1; font-size:12px; font-weight:900; }
@media (max-width:760px) { .doc-grid,.employer-doc-grid { grid-template-columns:1fr; } }
`],
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
