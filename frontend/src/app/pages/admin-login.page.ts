import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonNote],
  template: `
<ion-content class="admin-login-page">
  <main class="admin-login-shell">
    <section class="login-brand">
      <div class="brand-mark"><ion-icon name="shield-checkmark-outline"></ion-icon></div>
      <p class="eyebrow">BJED Chauffeur Admin</p>
      <h1>Control room access</h1>
      <p>Desktop-ready sign in for administrators managing bookings, chauffeurs, verification, and live operations.</p>
    </section>

    <section class="login-card">
      <div class="card-top">
        <span><ion-icon name="lock-closed-outline"></ion-icon></span>
        <div><p class="eyebrow">Secure admin login</p><h2>Sign in as admin</h2></div>
      </div>
      <ion-item>
        <ion-label position="stacked">Admin email or phone</ion-label>
        <ion-input [(ngModel)]="contact" autocomplete="username" placeholder="admin@bjed.com or 080..." />
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Password</ion-label>
        <ion-input [(ngModel)]="password" type="password" autocomplete="current-password" placeholder="Enter password" />
      </ion-item>
      <ion-note color="danger" *ngIf="error">{{ error }}</ion-note>
      <ion-button expand="block" (click)="submit()" [disabled]="busy || !contact || !password">{{ busy ? 'Signing in...' : 'Enter admin workspace' }}</ion-button>
      <p class="muted"><a routerLink="/login">Use regular app login</a></p>
    </section>
  </main>
</ion-content>
  `,
  styles: [`
.admin-login-page { --background:#07111f; color:#f8fafc; }
.admin-login-shell { min-height:100%; display:grid; grid-template-columns:1.05fr .95fr; gap:26px; align-items:center; width:min(1080px,100%); margin:0 auto; padding:40px 18px; }
.login-brand { display:grid; gap:12px; }
.brand-mark { width:78px; height:78px; display:grid; place-items:center; border-radius:26px; color:#fff; background:linear-gradient(135deg,#1954d1,#7c3aed); box-shadow:0 24px 70px rgba(25,84,209,.35); }
.brand-mark ion-icon { font-size:40px; }
.eyebrow { margin:0; color:#93c5fd; font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
h1 { margin:0; max-width:640px; font-size:clamp(34px,5vw,62px); line-height:.95; letter-spacing:-.05em; }
.login-brand p:not(.eyebrow) { margin:0; max-width:540px; color:#cbd5e1; font-size:15px; line-height:1.65; }
.login-card { display:grid; gap:14px; padding:24px; border:1px solid rgba(255,255,255,.12); border-radius:24px; background:rgba(255,255,255,.08); box-shadow:0 30px 80px rgba(0,0,0,.28); backdrop-filter:blur(18px); }
.card-top { display:flex; align-items:center; gap:12px; }
.card-top span { width:48px; height:48px; display:grid; place-items:center; border-radius:16px; color:#fff; background:#16a34a; }
.card-top ion-icon { font-size:24px; }
h2 { margin:2px 0 0; font-size:22px; }
ion-item { --background:rgba(255,255,255,.92); --color:#172033; --border-radius:14px; --padding-start:14px; border-radius:14px; overflow:hidden; }
ion-button { --background:#1954d1; --border-radius:14px; min-height:48px; font-weight:900; text-transform:none; }
ion-note { font-size:12px; font-weight:800; }
.muted { margin:0; text-align:center; font-size:13px; }
.muted a { color:#bfdbfe; font-weight:900; }
@media (max-width:780px) { .admin-login-shell { grid-template-columns:1fr; align-content:center; } }
  `],
})
export class AdminLoginPage {
  contact = '';
  password = '';
  error = '';
  busy = false;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async submit() {
    this.busy = true;
    this.error = '';
    try {
      const session = await this.auth.adminLogin(this.contact, this.password);
      await this.router.navigateByUrl(this.auth.dashboardFor(session.user.role));
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unable to sign in as admin';
    } finally {
      this.busy = false;
    }
  }
}
