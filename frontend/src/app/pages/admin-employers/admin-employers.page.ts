import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminNavComponent } from '../admin-nav.component';
import { AdminUser } from '../admin-types';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar, AdminNavComponent, WorkspaceHeaderComponent],
  templateUrl: './admin-employers.page.html',
  styleUrl: './admin-employers.page.scss'
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
