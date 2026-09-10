import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject } from '@angular/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { NavigationEnd, NavigationError, NavigationStart, Router, RouterLink } from '@angular/router';
import { IonApp, IonBadge, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonRouterOutlet, IonToolbar, MenuController } from '@ionic/angular/standalone';
import { ApiService } from './core/api.service';
import { AudioCallService } from './core/audio-call.service';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';
import { LiveCallSession, RealtimeService } from './core/realtime.service';

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
          <ion-item button detail="false" routerLink="/support" (click)="closeMenu()"><ion-icon name="help-circle-outline" slot="start"></ion-icon><ion-label>Support</ion-label></ion-item>
          <ion-item button detail="false" routerLink="/settings" (click)="closeMenu()"><ion-icon name="settings-outline" slot="start"></ion-icon><ion-label>Settings</ion-label></ion-item>
        </ng-container>
        <ng-template #workspaceMenu>
        <ion-item button detail="false" routerLink="/settings" (click)="closeMenu()"><ion-icon name="settings-outline" slot="start"></ion-icon><ion-label>Settings</ion-label></ion-item>
        <ion-item button detail="false" [routerLink]="profilePath" (click)="closeMenu()"><ion-icon name="person-outline" slot="start"></ion-icon><ion-label>My Profile</ion-label></ion-item>
        <ion-item button detail="false" routerLink="/support" (click)="closeMenu()"><ion-icon name="help-circle-outline" slot="start"></ion-icon><ion-label>Support</ion-label></ion-item>
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
  <div class="call-backdrop" *ngIf="incomingCall || activeCall">
    <section class="call-card incoming" *ngIf="incomingCall as call">
      <span class="call-icon"><ion-icon name="call-outline"></ion-icon></span>
      <p class="call-eyebrow">{{ call.target === 'conference' ? 'Conference call' : call.target === 'support' ? 'Support call' : 'Watchtower call' }}</p>
      <h2>{{ call.callerName }}</h2>
      <p>{{ call.bookingLabel }}</p>
      <div class="call-actions">
        <button class="decline" type="button" (click)="answerCall(false)">Decline</button>
        <button class="accept" type="button" (click)="answerCall(true)">Accept</button>
      </div>
    </section>
    <section class="call-card active" *ngIf="!incomingCall && activeCall as call">
      <span class="call-icon connected"><ion-icon name="call-outline"></ion-icon></span>
      <p class="call-eyebrow">{{ callStatus }}</p>
      <h2>{{ call.target === 'conference' ? 'Conference call' : call.target === 'support' ? 'Support call' : 'Live booking call' }}</h2>
      <p>{{ call.bookingLabel }}</p>
      <p class="call-error" *ngIf="callError">{{ callError }}</p>
      <div class="call-actions">
        <button class="mute" type="button" (click)="toggleMute()">{{ muted ? 'Unmute' : 'Mute' }}</button>
        <button class="decline" type="button" (click)="endActiveCall()">End call</button>
      </div>
    </section>
  </div>
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
.call-backdrop { position:fixed; inset:0; z-index:100000; display:grid; place-items:end center; padding:18px; background:rgba(5,11,22,.42); backdrop-filter:blur(5px); }
.call-card { width:min(420px,100%); box-sizing:border-box; padding:20px; border-radius:14px; background:#fff; color:#101828; box-shadow:0 24px 70px rgba(2,8,23,.28); text-align:center; }
.call-icon { width:62px; height:62px; margin:0 auto 12px; display:grid; place-items:center; border-radius:50%; color:#fff; background:#16a34a; box-shadow:0 0 0 10px rgba(22,163,74,.12); animation:call-pulse 1s ease-in-out infinite alternate; }
.call-icon.connected { animation:none; background:#1954d1; box-shadow:0 0 0 10px rgba(25,84,209,.12); }
.call-icon ion-icon { font-size:30px; }
.call-eyebrow { margin:0 0 6px; color:#c39454; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; }
.call-card h2 { margin:0 0 6px; color:#101828; font-size:23px; font-weight:900; letter-spacing:0; }
.call-card p { margin:0 0 16px; color:#667085; font-size:13px; line-height:1.4; }
.call-card .call-error { margin-top:-4px; color:#b42318; font-weight:800; }
.call-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.call-card button { min-height:48px; border:0; border-radius:8px; font:inherit; font-size:14px; font-weight:900; cursor:pointer; }
.call-card .decline { background:#fee2e2; color:#b42318; }
.call-card .accept { background:#16a34a; color:#fff; }
.call-card .mute { background:rgba(25,84,209,.1); color:#1954d1; }
.call-card .wide { width:100%; }
@keyframes call-pulse { from { transform:scale(.98); } to { transform:scale(1.04); } }
:host-context(body.dark-theme) .call-card,
:host-context(body.driver-dark-theme) .call-card { background:#0d1420; color:#f8fafc; }
:host-context(body.dark-theme) .call-card h2,
:host-context(body.driver-dark-theme) .call-card h2 { color:#f8fafc; }
:host-context(body.dark-theme) .call-card p,
:host-context(body.driver-dark-theme) .call-card p { color:#b7c0cf; }
  `],
})
export class AppComponent {
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly menu = inject(MenuController);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  private readonly audioCall = inject(AudioCallService);
  notificationCount = 0;
  showAngularSplash = true;
  incomingCall: LiveCallSession | null = null;
  activeCall: LiveCallSession | null = null;
  callStatus = 'Ringing';
  callError = '';
  muted = false;
  private swipeStartX: number | null = null;
  private swipeStartY: number | null = null;

  constructor() {
    this.finishBootSplash();
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.blurFocusedElement();
      if (event instanceof NavigationEnd) this.clearLazyChunkReloadFlag();
      if (event instanceof NavigationError) this.recoverFromLazyChunkError(event.error);
    });
    effect(() => {
      const session = this.auth.session();
      if (session?.token) this.realtime.connect(session.token); else this.realtime.disconnect();
      void this.loadNotificationCount(session?.token, session?.user?.role);
    });
    this.realtime.events$.subscribe((event) => {
      if (event.kind === 'notification') this.notificationCount += 1;
      if (event.kind === 'call-ring') this.incomingCall = event.call;
      if (event.kind === 'call-started') void this.prepareOutgoingCall(event.call);
      if (event.kind === 'call-response' && this.activeCall?.id === event.sessionId) void this.handleCallResponse(event);
      if (event.kind === 'call-ended') this.clearCall(event.sessionId);
      if (event.kind === 'call-signal' && this.activeCall?.id === event.sessionId) void this.handleCallSignal(event);
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

  private recoverFromLazyChunkError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/failed to fetch dynamically imported module|loading chunk|module script failed|chunk-\w+\.js/i.test(message)) return;
    const reloadKey = 'bjed-lazy-chunk-reload';
    if (sessionStorage.getItem(reloadKey) === '1') return;
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  }

  private clearLazyChunkReloadFlag() {
    sessionStorage.removeItem('bjed-lazy-chunk-reload');
  }

  async answerCall(accepted: boolean) {
    const call = this.incomingCall;
    if (!call) return;
    this.callError = '';
    if (accepted) {
      try {
        await this.audioCall.prepare(call.id, this.currentUserId);
      } catch (error) {
        this.callError = error instanceof Error ? error.message : 'Could not access microphone.';
        return;
      }
    }
    this.incomingCall = null;
    try {
      const result = await this.realtime.respondToCall(call.id, accepted);
      this.activeCall = accepted ? result.call : null;
      this.callStatus = accepted ? 'Connecting audio' : 'Declined';
    } catch {
      this.activeCall = null;
      this.callStatus = 'Ended';
    }
  }

  async endActiveCall() {
    const call = this.activeCall;
    this.activeCall = null;
    this.audioCall.stop();
    if (!call) return;
    await this.realtime.endCall(call.id).catch(() => undefined);
  }

  private clearCall(sessionId: string) {
    if (this.incomingCall?.id === sessionId) this.incomingCall = null;
    if (this.activeCall?.id === sessionId) {
      this.activeCall = null;
      this.audioCall.stop();
    }
    this.callStatus = 'Ended';
  }

  private async prepareOutgoingCall(call: LiveCallSession) {
    this.activeCall = call;
    this.callStatus = 'Ringing';
    this.callError = '';
    try {
      await this.audioCall.prepare(call.id, this.currentUserId);
    } catch (error) {
      this.callError = error instanceof Error ? error.message : 'Could not access microphone.';
      this.callStatus = 'Microphone blocked';
    }
  }

  private async handleCallResponse(event: { sessionId: string; userId: string; accepted: boolean }) {
    this.callStatus = event.accepted ? 'Connecting audio' : 'Declined';
    if (!event.accepted || !this.activeCall) return;
    const isCaller = this.activeCall.callerId === this.currentUserId;
    const shouldConnect = isCaller || this.activeCall.target === 'conference';
    if (!shouldConnect) return;
    try {
      await this.audioCall.connectToPeer(event.sessionId, event.userId, isCaller);
      this.callStatus = 'Connected';
    } catch (error) {
      this.callError = error instanceof Error ? error.message : 'Could not connect audio.';
    }
  }

  private async handleCallSignal(event: { sessionId: string; fromUserId: string; signal: unknown }) {
    try {
      await this.audioCall.handleSignal(event.sessionId, event.fromUserId, event.signal);
      this.callStatus = 'Connected';
    } catch (error) {
      this.callError = error instanceof Error ? error.message : 'Audio connection failed.';
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audioCall.setMuted(this.muted);
  }

  private get currentUserId() {
    return this.auth.session()?.user?.id || '';
  }
}
