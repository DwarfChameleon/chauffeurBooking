import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminNavComponent } from '../admin-nav.component';
import { WorkspaceHeaderComponent } from '../workspace-header.component';

type AdminAccount = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  adminLevel: 'standard' | 'super';
  adminStatus: 'active' | 'deactivated';
  adminVerified: boolean;
  createdAt?: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent],
  templateUrl: './admin-admins.page.html',
  styleUrl: './admin-admins.page.scss'
})
export class AdminAdminsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  admins: AdminAccount[] = [];
  canManageAdmins = false;
  loading = false;
  busy = false;
  error = '';
  success = '';
  form = { name: '', email: '', phone: '', password: '', adminLevel: 'standard' as 'standard' | 'super' };

  async ngOnInit() { await this.load(); }
  async refresh(event: CustomEvent) { try { await this.load(); } finally { await (event.target as any)?.complete(); } }

  async load() {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.loading = true;
    this.error = '';
    try {
      const data = await this.api.get<{ admins: AdminAccount[]; canManageAdmins: boolean }>('/admin/admins', token);
      this.admins = data.admins;
      this.canManageAdmins = data.canManageAdmins;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load admin accounts';
    } finally {
      this.loading = false;
    }
  }

  async createAdmin() {
    await this.mutate(async (token) => {
      const data = await this.api.post<{ admin: AdminAccount }>('/admin/admins', this.form, token);
      this.admins = [data.admin, ...this.admins];
      this.form = { name: '', email: '', phone: '', password: '', adminLevel: 'standard' };
      this.success = 'Admin account created.';
    });
  }

  async toggleLevel(admin: AdminAccount) {
    await this.updateAdmin(admin, { adminLevel: admin.adminLevel === 'super' ? 'standard' : 'super' });
  }

  async toggleStatus(admin: AdminAccount) {
    await this.updateAdmin(admin, { adminStatus: admin.adminStatus === 'active' ? 'deactivated' : 'active' });
  }

  async verify(admin: AdminAccount) {
    await this.updateAdmin(admin, { adminVerified: true, adminStatus: 'active' });
  }

  async deleteAdmin(admin: AdminAccount) {
    if (!window.confirm(`Delete ${admin.name || admin.email || 'this admin'}?`)) return;
    await this.mutate(async (token) => {
      await this.api.delete('/admin/admins/' + admin._id, token);
      this.admins = this.admins.filter((item) => item._id !== admin._id);
      this.success = 'Admin account deleted.';
    });
  }

  private async updateAdmin(admin: AdminAccount, body: Partial<AdminAccount>) {
    await this.mutate(async (token) => {
      const data = await this.api.patch<{ admin: AdminAccount }>('/admin/admins/' + admin._id, body, token);
      Object.assign(admin, data.admin);
      this.success = 'Admin account updated.';
    });
  }

  private async mutate(action: (token: string) => Promise<void>) {
    const token = this.auth.session()?.token;
    if (!token || !this.canManageAdmins) return;
    this.busy = true;
    this.error = '';
    this.success = '';
    try {
      await action(token);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Admin action failed';
    } finally {
      this.busy = false;
    }
  }
}
