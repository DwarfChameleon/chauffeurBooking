import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminNavComponent } from './admin-nav.component';
import { AdminUser } from './admin-types';
import { WorkspaceHeaderComponent } from './workspace-header.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar, AdminNavComponent, WorkspaceHeaderComponent],
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Users" [showBack]="true" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <p class="eyebrow">Account control</p><h1>All users</h1>
      <ion-searchbar placeholder="Search name, email or phone" (ionInput)="query = $any($event.target).value || ''"></ion-searchbar>
      <p class="state error" *ngIf="error">{{ error }}</p>
      <section class="list-panel">
        <article class="user-card" *ngFor="let user of filteredUsers">
          <div class="avatar"><ion-icon [name]="user.role === 'driver' ? 'car-sport-outline' : user.role === 'admin' ? 'shield-checkmark-outline' : 'business-outline'"></ion-icon></div>
          <div class="body"><strong>{{ user.name || user.email || user.phone || 'Unnamed account' }}</strong><small>{{ user.email || 'No email' }} • {{ user.phone || 'No phone' }}</small><span>{{ roleLabel(user) }}</span></div>
          <button class="danger" type="button" (click)="deleteUser(user)"><ion-icon name="trash-outline"></ion-icon></button>
        </article>
        <p class="empty" *ngIf="!loading && !filteredUsers.length">No users found.</p>
      </section>
    </main>
  </ion-content>
  <app-admin-nav active="users"></app-admin-nav>
</div>
  `,
  styles: [adminPageStyles()],
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

export function adminPageStyles() {
  return `
.admin-page ion-content { --background:var(--admin-bg,#f5f8fc); color:var(--admin-text,#101828); }
.admin-shell { padding:18px 14px 92px; max-width:1040px; margin:0 auto; }
.eyebrow { margin:0; color:#1954d1; font-size:11px; font-weight:900; text-transform:uppercase; }
h1 { margin:4px 0 14px; font-size:23px; color:var(--admin-text,#101828); }
ion-searchbar { --background:var(--admin-card,#fff); --color:var(--admin-text,#101828); --placeholder-color:var(--admin-muted,#667085); padding:0 0 12px; }
.list-panel { display:grid; gap:10px; }
.user-card,.driver-card,.booking-card,.verify-card,.notice-card { display:flex; align-items:center; gap:12px; padding:13px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; background:var(--admin-card,#fff); color:var(--admin-text,#101828); box-shadow:0 10px 28px rgba(15,23,42,.06); }
.driver-card,.booking-card { align-items:flex-start; }
.avatar { width:42px; height:42px; flex:0 0 42px; display:grid; place-items:center; border-radius:50%; color:#fff; background:#1954d1; overflow:hidden; }
.avatar.green { background:#16a34a; }.avatar.amber { background:#d97706; }.avatar.purple { background:#7c3aed; }
.avatar img { width:100%; height:100%; object-fit:cover; }
.avatar ion-icon { font-size:22px; }
.body { min-width:0; flex:1; }
.body strong,.body small,.body span { display:block; }
.body strong { color:var(--admin-text,#101828); line-height:1.25; overflow-wrap:anywhere; }
.body small,.empty { color:var(--admin-muted,#667085); font-size:12px; line-height:1.45; margin-top:3px; overflow-wrap:anywhere; }
.body span { width:max-content; max-width:100%; margin-top:7px; border-radius:999px; padding:5px 8px; background:rgba(25,84,209,.1); color:#1954d1; font-size:10px; line-height:1.25; font-weight:900; text-transform:uppercase; overflow-wrap:anywhere; }
.danger,.icon-button { width:40px; height:40px; border:0; border-radius:50%; display:grid; place-items:center; color:#b42318; background:#fee2e2; cursor:pointer; }
.icon-button { color:#1954d1; background:rgba(25,84,209,.1); }
.state { padding:12px; }.error { color:#b91c1c; }
select { min-height:38px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; padding:8px; color:var(--admin-text,#101828); background:var(--admin-card,#fff); }
.controls { display:flex; gap:8px; align-items:center; justify-content:flex-end; flex:0 0 auto; flex-wrap:wrap; }
.status-pill { border-radius:999px; padding:5px 8px; font-size:10px; font-weight:900; text-transform:uppercase; color:#334155; background:#e2e8f0; }
.status-pill.requested,.status-pill.assigned,.status-pill.accepted,.status-pill.arrived,.status-pill.pending { color:#92400e; background:#fef3c7; }
.status-pill.started,.status-pill.completed,.status-pill.verified { color:#166534; background:#dcfce7; }
.status-pill.cancelled,.status-pill.rejected { color:#991b1b; background:#fee2e2; }
:host-context(body.dark-theme) { --admin-bg:#070b13; --admin-card:#0d1420; --admin-line:rgba(255,255,255,.1); --admin-text:#f8fafc; --admin-muted:#b7c0cf; }
@media (max-width:620px) { .user-card,.driver-card,.booking-card,.verify-card { align-items:flex-start; flex-wrap:wrap; } .driver-card .body,.booking-card .body { flex-basis:calc(100% - 54px); } .driver-card .controls,.booking-card .controls { width:100%; justify-content:flex-start; padding-left:54px; } }
`;
}
