import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminNavComponent } from './admin-nav.component';
import { AdminUser } from './admin-types';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { adminPageStyles } from './admin-users.page';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar, AdminNavComponent, WorkspaceHeaderComponent],
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Employers" [showBack]="true" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <p class="eyebrow">Employer accounts</p><h1>Employer profiles</h1>
      <ion-searchbar placeholder="Search employer, city or state" (ionInput)="query = $any($event.target).value || ''"></ion-searchbar>
      <p class="state error" *ngIf="error">{{ error }}</p>
      <section class="list-panel">
        <article class="user-card" *ngFor="let user of filteredEmployers">
          <div class="avatar purple"><ion-icon name="business-outline"></ion-icon></div>
          <div class="body"><strong>{{ user.employerProfile?.companyName || user.name || 'Unnamed employer' }}</strong><small>{{ user.email || user.phone || 'No contact' }} • {{ user.employerProfile?.city || 'City not set' }}, {{ user.employerProfile?.state || 'State not set' }}</small><span>{{ user.employerProfile?.accountType || 'type not set' }}</span></div>
        </article>
        <p class="empty" *ngIf="!loading && !filteredEmployers.length">No employers found.</p>
      </section>
    </main>
  </ion-content>
  <app-admin-nav active="users"></app-admin-nav>
</div>
  `,
  styles: [adminPageStyles()],
})
export class AdminEmployersPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  employers: AdminUser[] = [];
  query = '';
  loading = false;
  error = '';

  get filteredEmployers() {
    const value = this.query.trim().toLowerCase();
    if (!value) return this.employers;
    return this.employers.filter((user) => [user.name, user.email, user.phone, user.employerProfile?.companyName, user.employerProfile?.city, user.employerProfile?.state].some((item) => String(item || '').toLowerCase().includes(value)));
  }

  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.loading = true;
    this.error = '';
    try {
      const users = await this.api.get<AdminUser[]>('/admin/users', token);
      this.employers = users.filter((user) => user.role === 'user');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load employers';
    } finally {
      this.loading = false;
    }
  }
}
