import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminNavComponent } from './admin-nav.component';
import { adminPageStyles } from './admin-users.page';
import { WorkspaceHeaderComponent } from './workspace-header.component';

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
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Profile" [showBack]="true" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <section class="profile-hero">
        <div class="profile-avatar">{{ profile?.initials || 'AD' }}</div>
        <div>
          <p class="eyebrow">Admin account</p>
          <h1>{{ profile?.name || profile?.email || 'Administrator' }}</h1>
          <p>{{ profile?.workspace?.appName || 'BJED Chauffeur' }} control access</p>
        </div>
      </section>

      <p class="state error" *ngIf="error">{{ error }}</p>

      <section class="profile-grid" *ngIf="profile as admin">
        <article class="profile-card blue">
          <div class="card-head"><ion-icon name="person-circle-outline"></ion-icon><h2>Identity</h2></div>
          <dl>
            <div><dt>Full name</dt><dd>{{ admin.name || 'Not set' }}</dd></div>
            <div><dt>Email</dt><dd>{{ admin.email || 'Not set' }}</dd></div>
            <div><dt>Phone</dt><dd>{{ admin.phone || 'Not set' }}</dd></div>
            <div><dt>Role</dt><dd>{{ admin.role | titlecase }}</dd></div>
          </dl>
        </article>

        <article class="profile-card green">
          <div class="card-head"><ion-icon name="shield-checkmark-outline"></ion-icon><h2>Workspace Access</h2></div>
          <div class="permission-list">
            <span *ngFor="let permission of admin.workspace.permissions"><ion-icon name="checkmark-circle-outline"></ion-icon>{{ label(permission) }}</span>
          </div>
        </article>

        <article class="profile-card purple wide">
          <div class="card-head"><ion-icon name="apps-outline"></ion-icon><h2>Admin workspace</h2></div>
          <div class="workspace-grid">
            <a *ngFor="let page of admin.workspace.pages" [href]="page.route" (click)="$event.preventDefault(); go(page.route)">
              <ion-icon [name]="page.icon"></ion-icon>
              <span>{{ page.label }}</span>
            </a>
          </div>
        </article>

        <article class="profile-card amber">
          <div class="card-head"><ion-icon name="time-outline"></ion-icon><h2>Account History</h2></div>
          <dl>
            <div><dt>Created</dt><dd>{{ displayDate(admin.createdAt) }}</dd></div>
            <div><dt>Last updated</dt><dd>{{ displayDate(admin.updatedAt) }}</dd></div>
            <div><dt>Default landing</dt><dd>{{ admin.workspace.landingRoute }}</dd></div>
          </dl>
        </article>
      </section>

      <section class="empty-card" *ngIf="!loading && !profile && !error">
        <ion-icon name="person-circle-outline"></ion-icon>
        <p>No admin profile loaded yet.</p>
      </section>
    </main>
  </ion-content>
  <app-admin-nav active="dashboard"></app-admin-nav>
</div>
  `,
  styles: [adminPageStyles() + `
.profile-hero { display:flex; align-items:center; gap:14px; padding:16px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; background:linear-gradient(135deg,rgba(25,84,209,.12),rgba(124,58,237,.12)), var(--admin-card,#fff); box-shadow:0 10px 28px rgba(15,23,42,.06); }
.profile-hero h1 { margin:2px 0 4px; }
.profile-hero p:not(.eyebrow) { margin:0; color:var(--admin-muted,#667085); font-size:13px; }
.profile-avatar { width:66px; height:66px; flex:0 0 66px; display:grid; place-items:center; border-radius:20px; color:#fff; background:linear-gradient(135deg,#1954d1,#7c3aed); font-size:22px; font-weight:900; box-shadow:0 14px 28px rgba(25,84,209,.25); }
.profile-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:14px; }
.profile-card { padding:14px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; background:var(--admin-card,#fff); box-shadow:0 10px 28px rgba(15,23,42,.06); }
.profile-card.wide { grid-column:1 / -1; }
.card-head { display:flex; align-items:center; gap:9px; margin-bottom:12px; }
.card-head ion-icon { width:34px; height:34px; padding:8px; border-radius:50%; color:#fff; }
.card-head h2 { margin:0; color:var(--admin-text,#101828); font-size:17px; }
.profile-card.blue .card-head ion-icon { background:#1954d1; }.profile-card.green .card-head ion-icon { background:#16a34a; }.profile-card.purple .card-head ion-icon { background:#7c3aed; }.profile-card.amber .card-head ion-icon { background:#d97706; }
dl { display:grid; gap:10px; margin:0; }
dl div { display:grid; gap:3px; padding:10px; border-radius:8px; background:rgba(148,163,184,.09); }
dt { color:var(--admin-muted,#667085); font-size:10px; font-weight:900; text-transform:uppercase; }
dd { margin:0; color:var(--admin-text,#101828); font-size:13px; font-weight:800; overflow-wrap:anywhere; }
.permission-list { display:flex; flex-wrap:wrap; gap:8px; }
.permission-list span { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:8px 10px; color:#166534; background:#dcfce7; font-size:11px; font-weight:900; }
.workspace-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; }
.workspace-grid a { display:grid; justify-items:start; gap:7px; min-height:76px; padding:12px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; color:var(--admin-text,#101828); background:rgba(25,84,209,.07); text-decoration:none; font-size:12px; font-weight:900; }
.workspace-grid ion-icon { color:#1954d1; font-size:24px; }
.empty-card { display:grid; justify-items:center; gap:8px; margin-top:14px; padding:24px; border:1px dashed var(--admin-line,#dbe5f2); border-radius:8px; color:var(--admin-muted,#667085); }
.empty-card ion-icon { font-size:44px; color:#1954d1; }
:host-context(body.dark-theme) .profile-hero { background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(25,84,209,.12)), var(--admin-card,#0d1420); }
:host-context(body.dark-theme) .workspace-grid a { background:rgba(124,58,237,.13); }
:host-context(body.dark-theme) .workspace-grid ion-icon { color:#d8b4fe; }
@media (max-width:760px) { .profile-grid,.workspace-grid { grid-template-columns:1fr; } .profile-hero { align-items:flex-start; } }
  `],
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
