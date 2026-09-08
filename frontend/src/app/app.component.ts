import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { IonApp, IonBadge, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonRouterOutlet, IonToolbar, MenuController } from '@ionic/angular/standalone';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';
import { RealtimeService } from './core/realtime.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, IonApp, IonBadge, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonRouterOutlet, IonToolbar],
  template: `
<ion-app>
  <div class="app-splash" *ngIf="showAngularSplash" aria-label="BJED Chauffeur loading">
    <img src="assets/images/logo.png" alt="BJED Chauffeur" />
  </div>
  <ion-menu class="workspace-side-menu" menuId="workspace-menu" contentId="main-content" side="start" [class.driver-menu]="role === 'driver'" [class.employer-menu]="role === 'employer'" [class.admin-menu]="role === 'admin'">
    <ion-header class="workspace-menu-header">
      <ion-toolbar>
        <div class="menu-brand">
          <strong>BJED Chauffeur</strong>
          <span>{{ userEmail }}</span>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list lines="none">
        <div class="menu-divider"></div>
        <ng-container *ngIf="role === 'admin'; else workspaceMenu">
          <ion-item button detail="false" routerLink="/admin/dashboard" (click)="closeMenu()"><ion-icon name="grid-outline" slot="start"></ion-icon><ion-label>Dashboard</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/admin/profile" (click)="closeMenu()"><ion-icon name="person-circle-outline" slot="start"></ion-icon><ion-label>Admin Profile</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/admin/admins" (click)="closeMenu()"><ion-icon name="shield-half-outline" slot="start"></ion-icon><ion-label>Admin Control</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/admin/users" (click)="closeMenu()"><ion-icon name="people-outline" slot="start"></ion-icon><ion-label>Users</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/admin/employers" (click)="closeMenu()"><ion-icon name="business-outline" slot="start"></ion-icon><ion-label>Employers</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/admin/drivers" (click)="closeMenu()"><ion-icon name="car-sport-outline" slot="start"></ion-icon><ion-label>Drivers</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/admin/bookings" (click)="closeMenu()"><ion-icon name="calendar-outline" slot="start"></ion-icon><ion-label>Bookings</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/admin/verification" (click)="closeMenu()"><ion-icon name="shield-checkmark-outline" slot="start"></ion-icon><ion-label>Verification</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/admin/notifications" (click)="closeMenu()"><ion-icon name="notifications-outline" slot="start"></ion-icon><ion-label>Notifications</ion-label><ion-badge slot="end" *ngIf="notificationCount > 0">{{ notificationCount }}</ion-badge></ion-item>
        </ng-container>
        <ng-template #workspaceMenu>
        <ion-item button detail="false" (click)="closeMenu()"><ion-icon name="settings-outline" slot="start"></ion-icon><ion-label>Settings</ion-label></ion-item>
        <ion-item button detail="false" [routerLink]="profilePath" (click)="closeMenu()"><ion-icon name="person-outline" slot="start"></ion-icon><ion-label>My Profile</ion-label></ion-item>
        <ion-item button detail="false" (click)="closeMenu()"><ion-icon name="help-circle-outline" slot="start"></ion-icon><ion-label>Support</ion-label></ion-item>
        <ion-item button detail="false" (click)="closeMenu()"><ion-icon name="information-circle-outline" slot="start"></ion-icon><ion-label>About</ion-label></ion-item>
        <ion-item button detail="false" (click)="closeMenu()"><ion-icon name="document-text-outline" slot="start"></ion-icon><ion-label>Terms and Conditions</ion-label></ion-item>
        <ion-item button detail="false" (click)="closeMenu()"><ion-icon name="shield-checkmark-outline" slot="start"></ion-icon><ion-label>Privacy policy</ion-label></ion-item>
        <ion-item button detail="false" routerLink="/employer/notifications" (click)="closeMenu()" *ngIf="role === 'employer'"><ion-icon name="notifications-outline" slot="start"></ion-icon><ion-label>Notifications</ion-label><ion-badge slot="end" *ngIf="notificationCount > 0">{{ notificationCount }}</ion-badge></ion-item>
        <ion-item button detail="false" routerLink="/driver/notifications" (click)="closeMenu()" *ngIf="role === 'driver'"><ion-icon name="notifications-outline" slot="start"></ion-icon><ion-label>Notifications</ion-label><ion-badge slot="end" *ngIf="notificationCount > 0">{{ notificationCount }}</ion-badge></ion-item>
        </ng-template>
        <ion-item button detail="false" class="signout-menu-item" (click)="signOut()"><ion-icon name="log-out-outline" slot="start"></ion-icon><ion-label>Sign out</ion-label></ion-item>
      </ion-list>
    </ion-content>
  </ion-menu>
  <ion-router-outlet id="main-content" />
</ion-app>
  `,
  styles: [`
.app-splash { position:fixed; inset:0; z-index:99999; display:grid; place-items:center; background:#f8f5ef; pointer-events:none; animation:app-splash-out .28s ease 1.15s forwards; }
.app-splash img { width:60px; height:60px; object-fit:contain; animation:app-logo-pulse .72s ease-in-out infinite alternate; }
@keyframes app-logo-pulse { from { width:60px; height:60px; transform:scale(1); opacity:.86; } to { width:80px; height:80px; transform:scale(1.02); opacity:1; } }
@keyframes app-splash-out { to { opacity:0; visibility:hidden; } }
ion-menu.workspace-side-menu { --menu-bg:#f7f9fc; --menu-text:#172033; --menu-icon:var(--app-primary); --menu-item-bg:transparent; --menu-divider:#e2e8f0; --menu-header-bg:var(--app-primary); --menu-header-text:#fff; }
.workspace-menu-header ion-toolbar { --background:var(--menu-header-bg); --color:var(--menu-header-text); --min-height:92px; padding:14px 18px; }
.menu-brand { display:flex; flex-direction:column; gap:5px; }
.menu-brand strong { font-size:20px; letter-spacing:-.02em; }
.menu-brand span { font-size:13px; opacity:.84; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
ion-menu ion-content { --background:var(--menu-bg); color:var(--menu-text); }
ion-menu ion-list,
ion-menu .list-md,
ion-menu .list-ios { background:var(--menu-bg); color:var(--menu-text); }
ion-menu ion-list { --ion-item-background:var(--menu-item-bg); --ion-text-color:var(--menu-text); padding:12px; }
ion-menu ion-item { --background:var(--menu-item-bg); --color:var(--menu-text); --border-color:transparent; color:var(--menu-text); margin:2px 0; }
ion-menu ion-item::part(native) { background:var(--menu-item-bg); color:var(--menu-text); }
ion-menu ion-item ion-label { color:var(--menu-text); }
ion-menu ion-item ion-icon { color:var(--menu-icon); font-size:20px; }
ion-menu ion-item.signout-menu-item { --color:#b42318; margin-top:8px; }
ion-menu ion-item.signout-menu-item ion-icon { color:#b42318; }
ion-menu ion-item ion-badge { --background:#ef4444; --color:#fff; font-size:10px; font-weight:900; }
.menu-divider { height:1px; background:var(--menu-divider); margin:12px 10px; }
:host-context(body.dark-theme) ion-menu.employer-menu ion-content,
:host-context(body.dark-theme) ion-menu.admin-menu ion-content,
:host-context(body.driver-dark-theme) ion-menu.driver-menu ion-content { --background:var(--menu-bg); }
:host-context(body.dark-theme) ion-menu.employer-menu ion-item,
:host-context(body.dark-theme) ion-menu.admin-menu ion-item,
:host-context(body.driver-dark-theme) ion-menu.driver-menu ion-item { --color:var(--menu-text); color:var(--menu-text); }
:host-context(body.dark-theme) ion-menu.employer-menu .menu-divider,
:host-context(body.dark-theme) ion-menu.admin-menu .menu-divider,
:host-context(body.driver-dark-theme) ion-menu.driver-menu .menu-divider { background:var(--menu-divider); }
:host-context(body.dark-theme) ion-menu.employer-menu,
:host-context(body.dark-theme) ion-menu.admin-menu,
:host-context(body.driver-dark-theme) ion-menu.driver-menu { --menu-bg:#0d1420; --menu-text:#f8fafc; --menu-icon:#d8b4fe; --menu-item-bg:transparent; --menu-divider:rgba(255,255,255,.12); --menu-header-bg:#0b1424; --menu-header-text:#f8fafc; }
:host-context(body.driver-light-theme) ion-menu.driver-menu { --menu-bg:#f7f9fc; --menu-text:#172033; --menu-icon:var(--app-primary); --menu-divider:#e2e8f0; --menu-header-bg:var(--app-primary); --menu-header-text:#fff; }
:host-context(body.driver-light-theme) ion-menu.driver-menu ion-content { --background:var(--menu-bg); }
:host-context(body.driver-light-theme) ion-menu.driver-menu ion-item { --color:var(--menu-text); }
:host-context(body.dark-theme) ion-menu.employer-menu .workspace-menu-header ion-toolbar,
:host-context(body.dark-theme) ion-menu.admin-menu .workspace-menu-header ion-toolbar,
:host-context(body.driver-dark-theme) ion-menu.driver-menu .workspace-menu-header ion-toolbar { --background:var(--menu-header-bg); --color:var(--menu-header-text); }
:host-context(body.driver-light-theme) ion-menu.driver-menu .workspace-menu-header ion-toolbar,
:host-context(body:not(.dark-theme)) ion-menu.employer-menu .workspace-menu-header ion-toolbar,
:host-context(body:not(.dark-theme)) ion-menu.admin-menu .workspace-menu-header ion-toolbar { --background:var(--menu-header-bg); --color:var(--menu-header-text); }
  `],
})
export class AppComponent {
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly menu = inject(MenuController);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  notificationCount = 0;
  showAngularSplash = true;
  private swipeStartX: number | null = null;
  private swipeStartY: number | null = null;

  constructor() {
    this.finishBootSplash();
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.blurFocusedElement();
    });
    effect(() => {
      const session = this.auth.session();
      if (session?.token) this.realtime.connect(session.token); else this.realtime.disconnect();
      void this.loadNotificationCount(session?.token, session?.user?.role);
    });
    this.realtime.events$.subscribe((event) => {
      if (event.kind === 'notification') this.notificationCount += 1;
      void this.loadNotificationCount(this.auth.session()?.token, this.auth.session()?.user?.role);
    });
  }

  private finishBootSplash() {
    document.getElementById('native-boot-loader')?.remove();
    window.setTimeout(() => {
      this.showAngularSplash = false;
      void SplashScreen.hide({ fadeOutDuration: 220 }).catch(() => undefined);
    }, 1450);
  }

  get role() { const role = this.auth.session()?.user?.role; return role === 'admin' ? 'admin' : role === 'driver' ? 'driver' : 'employer'; }
  get dashboardPath() { return this.role === 'admin' ? '/admin/dashboard' : this.role === 'driver' ? '/driver/dashboard' : '/employer/dashboard'; }
  get profilePath() { return this.role === 'admin' ? '/admin/profile' : this.role === 'driver' ? '/driver/profile' : '/employer/profile'; }
  get userEmail() { return this.auth.session()?.user?.email || this.auth.session()?.user?.phone || 'Signed-in account'; }

  private async loadNotificationCount(token?: string, userRole?: string) {
    if (!token) { this.notificationCount = 0; return; }
    try {
      const data = await this.api.get<any>('/notifications', token);
      this.notificationCount = data.unreadCount || 0;
    } catch { this.notificationCount = 0; }
  }

  @HostListener('window:touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    this.swipeStartX = event.touches[0].clientX;
    this.swipeStartY = event.touches[0].clientY;
  }

  @HostListener('window:touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    if (this.swipeStartX === null || this.swipeStartY === null || event.changedTouches.length !== 1) return;
    const target = event.target as HTMLElement | null;
    const dx = event.changedTouches[0].clientX - this.swipeStartX;
    const dy = event.changedTouches[0].clientY - this.swipeStartY;
    this.swipeStartX = null;
    this.swipeStartY = null;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35 || target?.closest('ion-modal,input,textarea,select,button')) return;
    const path = this.router.url.split('?')[0].split('#')[0];
    const employerPages = ['/employer/dashboard', '/employer/chauffeurs', '/book-driver', '/employer/profile'];
    const driverPages = ['/driver/dashboard', '/driver/bookings', '/driver/earnings', '/driver/profile'];
    const adminPages = ['/admin/dashboard', '/admin/profile', '/admin/admins', '/admin/users', '/admin/drivers', '/admin/bookings', '/admin/verification'];
    const pages = path.startsWith('/admin/') ? adminPages : path.startsWith('/driver/') ? driverPages : path.startsWith('/employer/') || path === '/book-driver' ? employerPages : [];
    const index = pages.indexOf(path);
    if (index < 0) return;
    const nextIndex = dx < 0 ? index + 1 : index - 1;
    if (nextIndex >= 0 && nextIndex < pages.length) void this.router.navigateByUrl(pages[nextIndex]);
  }

  async closeMenu() {
    await this.menu.close('workspace-menu');
  }

  async signOut() {
    await this.closeMenu();
    this.auth.logout();
  }

  private blurFocusedElement() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement.closest('ion-router-outlet')) activeElement.blur();
  }
}
