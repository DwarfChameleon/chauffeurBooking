import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { NIGERIA_PHONE_ERROR, isValidNigeriaPhone } from '../core/nigeria-phone';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonTitle, IonToolbar],
  template: `
<ion-header class="auth-header">
  <ion-toolbar>
    <ion-buttons slot="start"><ion-button fill="clear" (click)="back()"><ion-icon name="arrow-back-outline" slot="icon-only"></ion-icon></ion-button></ion-buttons>
    <ion-title>Sign up</ion-title>
  </ion-toolbar>
</ion-header>
<ion-content>
  <main class="register-shell">
    <section class="register-card">
      <p class="eyebrow">Create account</p>
      <h1>{{ step === 'role' ? 'Choose your role' : step === 'employerType' ? 'Employer type' : roleLabel + ' registration' }}</h1>

      <ng-container *ngIf="step === 'role'; else nextStep">
        <div class="role-grid">
          <button class="role-card" [class.active]="role === 'driver'" type="button" (click)="chooseRole('driver')"><ion-icon name="car-sport-outline"></ion-icon><strong>Chauffeur</strong><span>Drive, receive bookings, update routes and documents.</span></button>
          <button class="role-card" [class.active]="role === 'user'" type="button" (click)="chooseRole('user')"><ion-icon name="business-outline"></ion-icon><strong>Employer</strong><span>Book chauffeurs, manage requests and verify profile.</span></button>
        </div>
        <ion-button expand="block" (click)="continueFromRole()">Continue</ion-button>
      </ng-container>

      <ng-template #nextStep>
        <ng-container *ngIf="step === 'employerType'; else formStep">
          <button class="back-link" type="button" (click)="step = 'role'"><ion-icon name="arrow-back-outline"></ion-icon> Change role</button>
          <div class="account-type-grid">
            <button class="account-type-button" [class.active]="employerType === 'personal'" type="button" (click)="employerType = 'personal'"><ion-icon name="person-outline"></ion-icon><strong>Personal</strong><span>Book chauffeurs for individual errands, family, or personal movement.</span></button>
            <button class="account-type-button" [class.active]="employerType === 'organization'" type="button" (click)="employerType = 'organization'"><ion-icon name="business-outline"></ion-icon><strong>Organization</strong><span>Book chauffeurs for company, logistics, operations, or field teams.</span></button>
          </div>
          <ion-button expand="block" (click)="step = 'form'">Continue</ion-button>
        </ng-container>

        <ng-template #formStep>
          <button class="back-link" type="button" (click)="backFromForm()"><ion-icon name="arrow-back-outline"></ion-icon> Change {{ role === 'user' ? 'employer type' : 'role' }}</button>
          <ion-item><ion-label position="stacked">Full name</ion-label><ion-input [(ngModel)]="name" /></ion-item>
          <ion-item><ion-label position="stacked">Email</ion-label><ion-input [(ngModel)]="email" type="email" /></ion-item>
          <ion-item [class.invalid-phone]="!phoneIsValid"><ion-label position="stacked">Phone</ion-label><ion-input [(ngModel)]="phone" type="tel" /></ion-item>
          <ion-note color="danger" *ngIf="!phoneIsValid">{{ phoneError }}</ion-note>
          <ion-item><ion-label position="stacked">Password</ion-label><ion-input [(ngModel)]="password" type="password" /></ion-item>
          <ion-note color="danger" *ngIf="error">{{ error }}</ion-note>
          <ion-button expand="block" (click)="submit()" [disabled]="busy">{{ busy ? 'Creating...' : 'Create ' + roleLabel + ' account' }}</ion-button>
        </ng-template>
      </ng-template>

      <p class="muted">Already registered? <a routerLink="/login">Sign in</a></p>
    </section>
  </main>
</ion-content>
  `,
  styles: [`
:host { display:block; --ink:#172033; --muted:#667085; --line:#e6ebf2; --auth-primary:var(--app-primary); }
.auth-header { background:transparent; box-shadow:none; border:0; }
.auth-header::after { display:none; }
ion-toolbar { --background:transparent; --border-width:0; --box-shadow:none; --color:var(--auth-primary); color:var(--auth-primary); }
ion-title { color:var(--auth-primary); font-size:16px; font-weight:900; }
.auth-header ion-button { --color:var(--auth-primary); margin:0; }
.auth-header ion-icon { color:var(--auth-primary); }
.register-shell { min-height:100%; display:grid; justify-items:center; align-items:start; padding:50px 14px 24px; background:#f7f9fc; color:var(--ink); }
.register-card { width:min(560px,100%); padding:22px; border:1px solid var(--line); border-radius:8px; background:#fff; box-shadow:0 10px 28px rgba(20,32,61,.06); }
.eyebrow { margin:0 0 7px; color:var(--auth-primary); font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
h1 { margin:0 0 18px; font-size:26px; }
.role-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
.role-card { display:grid; gap:8px; min-height:150px; padding:16px; border:1px solid var(--line); border-radius:8px; color:var(--ink); background:#fbfcfe; text-align:left; cursor:pointer; }
.role-card.active { border-color:var(--auth-primary); box-shadow:0 0 0 3px var(--app-primary-soft); }
.role-card ion-icon { color:var(--auth-primary); font-size:28px; }
.role-card strong { font-size:16px; }
.role-card span,.muted { color:var(--muted); font-size:13px; line-height:1.45; }
.account-type-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
.account-type-button { display:grid; justify-items:start; gap:8px; min-height:132px; padding:16px; border:1px solid rgba(var(--app-primary-rgb),.25); border-radius:8px; color:var(--ink); background:transparent; text-align:left; cursor:pointer; }
.account-type-button.active { border-color:var(--auth-primary); background:var(--app-primary-soft); box-shadow:0 0 0 3px rgba(var(--app-primary-rgb),.1); }
.account-type-button ion-icon { color:var(--auth-primary); font-size:26px; }
.account-type-button strong { font-size:15px; }
.account-type-button span { color:var(--muted); font-size:13px; line-height:1.45; }
.back-link { display:inline-flex; align-items:center; gap:5px; margin-bottom:10px; border:0; color:var(--auth-primary); background:transparent; font:inherit; font-size:12px; font-weight:900; cursor:pointer; }
ion-item { --background:#fbfcfe; --border-color:#e6ebf2; margin-bottom:10px; border-radius:8px; }
ion-item.invalid-phone { --border-color:#f04438; --background:#fff7f6; color:#b42318; }
ion-note { display:block; margin:8px 0 12px; }
ion-button { margin-top:8px; }
.muted { margin:14px 0 0; text-align:center; }
:host-context(body.dark-theme) { --ink:#f8fafc; --muted:#a8b3c7; --line:rgba(255,255,255,.12); }
:host-context(body.dark-theme) .register-shell { background:#070b13; color:var(--ink); }
:host-context(body.dark-theme) .register-card { background:#0d1420; border-color:var(--line); box-shadow:0 12px 30px rgba(0,0,0,.28); }
:host-context(body.dark-theme) .role-card,
:host-context(body.dark-theme) .account-type-button,
:host-context(body.dark-theme) ion-item { --background:#111927; background:#111927; border-color:var(--line); color:var(--ink); }
:host-context(body.dark-theme) ion-label,
:host-context(body.dark-theme) ion-input { --color:var(--ink); color:var(--ink); }
:host-context(body.dark-theme) ion-item.invalid-phone { --background:rgba(244,63,94,.1); color:#fca5a5; }
@media (max-width:560px) { .role-grid,.account-type-grid { grid-template-columns:1fr; } h1 { font-size:22px; } }
  `],
})
export class RegisterPage {
  step: 'role' | 'employerType' | 'form' = 'role';
  name = '';
  email = '';
  phone = '';
  password = '';
  role: 'user' | 'driver' = 'user';
  employerType: 'personal' | 'organization' = 'personal';
  error = '';
  busy = false;
  readonly phoneError = NIGERIA_PHONE_ERROR;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  get roleLabel() {
    return this.role === 'driver' ? 'Chauffeur' : 'Employer';
  }

  get phoneIsValid() {
    return isValidNigeriaPhone(this.phone);
  }

  chooseRole(role: 'user' | 'driver') {
    this.role = role;
  }

  continueFromRole() {
    this.step = this.role === 'user' ? 'employerType' : 'form';
  }

  backFromForm() {
    this.step = this.role === 'user' ? 'employerType' : 'role';
  }

  back() {
    if (this.step === 'form') { this.backFromForm(); return; }
    if (this.step === 'employerType') { this.step = 'role'; return; }
    void this.router.navigateByUrl('/');
  }

  async submit() {
    this.busy = true;
    this.error = '';
    if (!this.phoneIsValid) {
      this.error = this.phoneError;
      this.busy = false;
      return;
    }
    try {
      const method = this.email.trim() ? 'email' : 'phone';
      const contact = method === 'email' ? this.email.trim() : this.phone.trim();
      const location = await this.getLocation();
      await this.auth.register({ name: this.name, contact, method, email: this.email.trim(), phone: this.phone.trim(), password: this.password, role: this.role, employerType: this.role === 'user' ? this.employerType : undefined, location: JSON.stringify(location) });
      await this.router.navigateByUrl('/registration-success');
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Unable to register';
    } finally {
      this.busy = false;
    }
  }

  private getLocation(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ latitude: 0, longitude: 0 });
      navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => resolve({ latitude: 0, longitude: 0 }), { enableHighAccuracy: true, timeout: 8000 });
    });
  }
}
