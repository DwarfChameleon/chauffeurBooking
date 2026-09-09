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
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss'
})
export class AdminUsersPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  users: AdminUser[] = [];
  query = '';
  loading = false;
  error = '';

  get filteredUsers() {
    const value = this.query.trim().toLowerCase();
    if (!value) return this.users;
    return this.users.filter((user) => [user.name, user.email, user.phone, user.role].some((item) => String(item || '').toLowerCase().includes(value)));
  }

  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }
  roleLabel(user: AdminUser) { return user.role === 'user' ? 'Employer' : user.role === 'driver' ? 'Chauffeur' : 'Admin'; }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.loading = true;
    this.error = '';
    try {
      this.users = await this.api.get<AdminUser[]>('/admin/users', token);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load users';
    } finally {
      this.loading = false;
    }
  }

  async deleteUser(user: AdminUser) {
    if (!window.confirm(`Delete ${user.name || user.email || user.phone || 'this user'}?`)) return;
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      await this.api.delete('/admin/users/' + user._id, token);
      this.users = this.users.filter((item) => item._id !== user._id);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not delete user';
    }
  }
}
