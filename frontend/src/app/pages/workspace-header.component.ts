import { CommonModule, Location } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonBadge, IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar, MenuController } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';

type WorkspaceRole = 'driver' | 'employer' | 'admin';

@Component({
  selector: 'app-workspace-header',
  standalone: true,
  imports: [CommonModule, IonBadge, IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar],
  template: `
<ion-header class="workspace-mobile-header" [class.driver-toolbar]="role === 'driver'" [class.admin-toolbar]="role === 'admin'">
  <ion-toolbar>
    <ion-buttons slot="start">
      <ion-button *ngIf="showBack || !showMenu" class="toolbar-icon" fill="clear" type="button" (click)="handleBack()" aria-label="Go back" title="Back">
        <ion-icon name="arrow-back-outline" slot="icon-only"></ion-icon>
      </ion-button>
      <ion-button *ngIf="showMenu && !showBack" class="toolbar-icon" fill="clear" type="button" (click)="openMenu()" aria-label="Open menu" title="Menu">
        <ion-icon name="menu-outline" slot="icon-only"></ion-icon>
      </ion-button>
    </ion-buttons>

    <ion-title>{{ title }}</ion-title>

    <ion-buttons slot="end">
      <ion-button class="toolbar-icon" fill="clear" type="button" (click)="refreshRequested.emit()" aria-label="Refresh" title="Refresh">
        <ion-icon name="refresh-outline" slot="icon-only"></ion-icon>
      </ion-button>
      <ion-button class="toolbar-icon notification-action" fill="clear" type="button" (click)="openNotifications()" aria-label="Notifications" title="Notifications">
        <ion-icon name="notifications-outline" slot="icon-only"></ion-icon>
        <ion-badge *ngIf="notificationCount > 0">{{ notificationCount }}</ion-badge>
      </ion-button>
      <ion-button *ngIf="showSignout" class="toolbar-icon signout-action" fill="clear" type="button" (click)="auth.logout()" aria-label="Sign out" title="Sign out">
        <ion-icon name="log-out-outline" slot="icon-only"></ion-icon>
      </ion-button>
      <ion-button class="toolbar-icon theme-toggle" fill="clear" type="button" (click)="toggleTheme()" [attr.aria-label]="isDark ? 'Switch to light mode' : 'Switch to dark mode'" [title]="isDark ? 'Light mode' : 'Dark mode'">
        <ion-icon [name]="isDark ? 'sunny-outline' : 'moon-outline'" slot="icon-only"></ion-icon>
      </ion-button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>
  `,
  styles: [`
.workspace-mobile-header { box-shadow:0 6px 18px rgba(15,23,42,.06); }
ion-toolbar { --min-height:56px; --padding-start:4px; --padding-end:4px; --background:rgba(255,255,255,.96); --color:#172033; --border-color:#e6ebf2; }
ion-title { padding-inline:6px; font-size:17px; font-weight:900; letter-spacing:-.02em; }
.toolbar-icon { position:relative; width:40px; height:40px; margin:0 1px; --padding-start:0; --padding-end:0; --border-radius:50%; --color:#1954d1; --background:rgba(25,84,209,.1); }
.toolbar-icon ion-icon { font-size:20px; color:currentColor; }
.notification-action ion-badge { position:absolute; top:2px; right:0; min-width:17px; height:17px; padding:0 4px; display:grid; place-items:center; --background:#ef4444; --color:#fff; border-radius:999px; font-size:10px; font-weight:900; }
.signout-action { --color:#7c3aed; --background:rgba(124,58,237,.14); }
:host-context(body.dark-theme) .workspace-mobile-header:not(.driver-toolbar) ion-toolbar,
:host-context(body.driver-dark-theme) .driver-toolbar ion-toolbar { --background:rgba(8,13,21,.96); --color:#f8fafc; --border-color:rgba(255,255,255,.1); }
:host-context(body.dark-theme) .workspace-mobile-header:not(.driver-toolbar) .toolbar-icon,
:host-context(body.driver-dark-theme) .driver-toolbar .toolbar-icon { --color:#d8b4fe; --background:rgba(124,58,237,.18); }
:host-context(body.driver-light-theme) .driver-toolbar ion-toolbar { --background:rgba(255,255,255,.98); --color:#172033; --border-color:#dbe5f2; }
:host-context(body.driver-light-theme) .driver-toolbar .toolbar-icon { --color:#1954d1; --background:rgba(25,84,209,.12); }
  `],
})
export class WorkspaceHeaderComponent {
  @Input() role: WorkspaceRole = 'employer';
  @Input() title = 'Dashboard';
  @Input() notificationCount = 0;
  @Input() showSignout = false;
  @Input() showBack = false;
  @Input() showMenu = false;
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() backRequested = new EventEmitter<void>();

  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly menu = inject(MenuController);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  get isDark() {
    return this.role === 'driver' ? this.theme.driverIsDark : this.theme.isDark;
  }

  async openMenu() {
    await this.menu.open('workspace-menu');
  }

  toggleTheme() {
    if (this.role === 'driver') this.theme.toggleDriver();
    else this.theme.toggle();
  }

  openNotifications() {
    void this.router.navigateByUrl(`/${this.role}/notifications`);
  }

  handleBack() {
    if (this.backRequested.observed) this.backRequested.emit();
    else if (window.history.length > 1) this.location.back();
    else void this.router.navigateByUrl(this.role === 'admin' ? '/admin/dashboard' : this.role === 'driver' ? '/driver/dashboard' : '/employer/dashboard');
  }
}
