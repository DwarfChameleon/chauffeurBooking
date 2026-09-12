import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonFooter, IonIcon } from '@ionic/angular/standalone';

type AdminTab = 'dashboard' | 'users' | 'bookings' | 'callcenter';

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [CommonModule, IonFooter, IonIcon],
  template: `
<ion-footer>
  <nav class="admin-bottom-nav" aria-label="Admin navigation">
    <button class="nav-item" [class.active]="active === 'dashboard'" type="button" (click)="navigate('/admin/dashboard')"><ion-icon name="grid-outline"></ion-icon><span>Dashboard</span></button>
    <button class="nav-item" [class.active]="active === 'users'" type="button" (click)="navigate('/admin/users')"><ion-icon name="people-outline"></ion-icon><span>Users</span></button>
    <button class="nav-item" [class.active]="active === 'bookings'" type="button" (click)="navigate('/admin/bookings')"><ion-icon name="calendar-outline"></ion-icon><span>Bookings</span></button>
    <button class="nav-item" [class.active]="active === 'callcenter'" type="button" (click)="navigate('/admin/callcenter')"><ion-icon name="call-outline"></ion-icon><span>Callcenter</span></button>
  </nav>
</ion-footer>
  `,
  styles: [`
.admin-bottom-nav { display:flex; align-items:center; justify-content:center; gap:8px; min-height:72px; border-top:1px solid var(--admin-line,#dbe5f2); background:var(--admin-card,#fff); padding:5px max(10px, env(safe-area-inset-left)) max(7px, env(safe-area-inset-bottom)); }
.nav-item { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; min-width:82px; min-height:54px; border:0; border-radius:8px; background:transparent; color:var(--admin-muted,#6b7280); font:inherit; font-size:10px; font-weight:800; cursor:pointer; }
.nav-item ion-icon { font-size:21px; }
.nav-item.active { color:var(--app-primary); background:rgba(var(--app-primary-rgb),.12); }
:host-context(body.dark-theme) .admin-bottom-nav { --admin-card:#0d1420; --admin-line:rgba(255,255,255,.1); }
:host-context(body.dark-theme) .nav-item { --admin-muted:#b7c0cf; }
:host-context(body.dark-theme) .nav-item.active { color:var(--app-primary-tint); background:rgba(var(--app-primary-rgb),.18); }
@media (max-width:620px) { .admin-bottom-nav { justify-content:space-around; gap:2px; } .nav-item { min-width:0; flex:1; } }
  `],
})
export class AdminNavComponent {
  @Input() active: AdminTab = 'dashboard';
  private readonly router = inject(Router);
  navigate(path: string) { void this.router.navigateByUrl(path); }
}
