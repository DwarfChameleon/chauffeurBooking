import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminNavComponent } from '../admin-nav.component';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

type AdminWorkspacePage = { key: string; label: string; route: string; icon: string };
type AdminProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  initials: string;
  workspace: { appName: string; landingRoute: string; pages: AdminWorkspacePage[]; permissions: string[] };
  createdAt?: string;
  updatedAt?: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent],
  templateUrl: './admin-profile.page.html',
  styleUrl: './admin-profile.page.scss'
})
export class AdminProfilePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  profile: AdminProfile | null = null;
  loading = false;
  error = '';

  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.loading = true;
    this.error = '';
    try {
      const data = await this.api.get<{ profile: AdminProfile }>('/admin/profile', token);
      this.profile = data.profile;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load admin profile';
    } finally {
      this.loading = false;
    }
  }

  go(route: string) {
    void this.router.navigateByUrl(route);
  }

  label(value: string) {
    return value.replace(/-/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
  }

  displayDate(value?: string) {
    return value ? new Date(value).toLocaleString() : 'Not available';
  }
}
