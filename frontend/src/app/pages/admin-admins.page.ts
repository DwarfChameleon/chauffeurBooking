import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminNavComponent } from './admin-nav.component';
import { adminPageStyles } from './admin-users.page';
import { WorkspaceHeaderComponent } from './workspace-header.component';

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
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Admin Control" [showBack]="true" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <section class="admin-control-hero">
        <div><p class="eyebrow">Super admin controls</p><h1>Admin accounts</h1><p>Create, verify, activate, deactivate, promote, demote, and remove administrator accounts.</p></div>
        <span class="access-pill" [class.locked]="!canManageAdmins"><ion-icon [name]="canManageAdmins ? 'shield-checkmark-outline' : 'lock-closed-outline'"></ion-icon>{{ canManageAdmins ? 'Super admin' : 'Read only' }}</span>
      </section>

      <p class="state error" *ngIf="error">{{ error }}</p>
      <p class="state success" *ngIf="success">{{ success }}</p>

      <section class="create-panel" *ngIf="canManageAdmins">
        <div class="panel-title"><div><p class="eyebrow">New administrator</p><h2>Create admin access</h2></div></div>
        <div class="form-grid">
          <label>Full name<input [(ngModel)]="form.name" placeholder="Admin name"></label>
          <label>Email<input [(ngModel)]="form.email" placeholder="admin@example.com"></label>
          <label>Phone<input [(ngModel)]="form.phone" placeholder="08031234567"></label>
          <label>Password<input [(ngModel)]="form.password" type="password" placeholder="Minimum 6 characters"></label>
          <label>Privilege<select [(ngModel)]="form.adminLevel"><option value="standard">Standard admin</option><option value="super">Super admin</option></select></label>
        </div>
        <ion-button (click)="createAdmin()" [disabled]="busy || !form.name || !form.password || (!form.email && !form.phone)">Create admin</ion-button>
      </section>

      <section class="list-panel admin-account-list">
        <article class="admin-account-card" *ngFor="let admin of admins">
          <div class="admin-avatar"><ion-icon [name]="admin.adminLevel === 'super' ? 'shield-checkmark-outline' : 'person-circle-outline'"></ion-icon></div>
          <div class="body">
            <strong>{{ admin.name || admin.email || admin.phone || 'Unnamed admin' }}</strong>
            <small>{{ admin.email || 'No email' }} • {{ admin.phone || 'No phone' }}</small>
            <div class="chip-row">
              <span [class.super]="admin.adminLevel === 'super'">{{ admin.adminLevel }}</span>
              <span [class.off]="admin.adminStatus === 'deactivated'">{{ admin.adminStatus }}</span>
              <span [class.verified]="admin.adminVerified">{{ admin.adminVerified ? 'verified' : 'unverified' }}</span>
            </div>
          </div>
          <div class="controls admin-controls" *ngIf="canManageAdmins">
            <button class="icon-button" type="button" (click)="toggleLevel(admin)" [title]="admin.adminLevel === 'super' ? 'Make standard admin' : 'Make super admin'"><ion-icon name="shield-half-outline"></ion-icon></button>
            <button class="icon-button" type="button" (click)="verify(admin)" title="Verify admin"><ion-icon name="checkmark-done-outline"></ion-icon></button>
            <button class="icon-button" type="button" (click)="toggleStatus(admin)" [title]="admin.adminStatus === 'active' ? 'Deactivate admin' : 'Activate admin'"><ion-icon [name]="admin.adminStatus === 'active' ? 'pause-circle-outline' : 'play-circle-outline'"></ion-icon></button>
            <button class="danger" type="button" (click)="deleteAdmin(admin)" title="Delete admin"><ion-icon name="trash-outline"></ion-icon></button>
          </div>
        </article>
        <p class="empty" *ngIf="!loading && !admins.length">No admin accounts found.</p>
      </section>
    </main>
  </ion-content>
  <app-admin-nav active="admins"></app-admin-nav>
</div>
  `,
  styles: [adminPageStyles() + `
.admin-control-hero,.create-panel { margin-bottom:14px; padding:16px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; background:var(--admin-card,#fff); box-shadow:0 10px 28px rgba(15,23,42,.06); }
.admin-control-hero { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; background:linear-gradient(135deg,rgba(25,84,209,.12),rgba(22,163,74,.12)), var(--admin-card,#fff); }
.admin-control-hero p:not(.eyebrow) { margin:0; color:var(--admin-muted,#667085); font-size:13px; line-height:1.5; }
.access-pill { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:8px 10px; color:#166534; background:#dcfce7; font-size:11px; font-weight:900; text-transform:uppercase; white-space:nowrap; }
.access-pill.locked { color:#92400e; background:#fef3c7; }
.panel-title h2 { margin:2px 0 0; color:var(--admin-text,#101828); font-size:17px; }
.form-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin:12px 0; }
label { display:grid; gap:6px; color:var(--admin-muted,#667085); font-size:11px; font-weight:900; text-transform:uppercase; }
input,select { width:100%; min-height:42px; box-sizing:border-box; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; padding:0 11px; color:var(--admin-text,#101828); background:var(--admin-card,#fff); font:inherit; font-size:13px; text-transform:none; }
ion-button { --border-radius:8px; --background:#1954d1; font-weight:900; text-transform:none; }
.success { color:#047857; }
.admin-account-list { gap:12px; }
.admin-account-card { display:flex; align-items:center; gap:12px; padding:13px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; background:var(--admin-card,#fff); box-shadow:0 10px 28px rgba(15,23,42,.06); }
.admin-avatar { width:46px; height:46px; flex:0 0 46px; display:grid; place-items:center; border-radius:16px; color:#fff; background:linear-gradient(135deg,#1954d1,#7c3aed); }
.admin-avatar ion-icon { font-size:24px; }
.chip-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.chip-row span { width:max-content; border-radius:999px; padding:5px 8px; color:#1954d1; background:rgba(25,84,209,.1); font-size:10px; font-weight:900; text-transform:uppercase; }
.chip-row .super { color:#6d28d9; background:#ede9fe; }
.chip-row .off { color:#991b1b; background:#fee2e2; }
.chip-row .verified { color:#166534; background:#dcfce7; }
.admin-controls { margin-left:auto; }
:host-context(body.dark-theme) .admin-control-hero { background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(22,163,74,.12)), var(--admin-card,#0d1420); }
@media (max-width:900px) { .form-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .admin-account-card { flex-wrap:wrap; align-items:flex-start; } .admin-controls { width:100%; justify-content:flex-start; padding-left:58px; } }
@media (max-width:560px) { .form-grid { grid-template-columns:1fr; } .admin-control-hero { flex-direction:column; } }
  `],
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
