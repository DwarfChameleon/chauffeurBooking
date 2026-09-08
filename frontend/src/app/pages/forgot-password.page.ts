import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonNote, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { NIGERIA_PHONE_ERROR, isValidNigeriaPhone } from '../core/nigeria-phone';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon, IonInput, IonNote, IonSpinner],
  template: `
<ion-content [fullscreen]="true" class="forgot-content">
  <main class="forgot-screen">
    <button type="button" class="back-btn" aria-label="Go back" (click)="back()">
      <ion-icon name="arrow-back-outline"></ion-icon>
    </button>

    <section class="brand-panel">
      <img src="assets/images/logo.png" alt="B-JED Chauffeur">
      <p>{{ verified ? 'Secure reset' : 'Account recovery' }}</p>
      <h1>{{ verified ? 'Create a new password' : 'Confirm your account' }}</h1>
      <span></span>
    </section>

    <section class="form-panel" *ngIf="!done; else successState">
      <ng-container *ngIf="!verified; else resetForm">
        <label>Email
          <div class="input-shell">
            <ion-icon name="person-outline"></ion-icon>
            <ion-input [(ngModel)]="email" name="email" type="email" autocomplete="email" placeholder="Enter email address"></ion-input>
          </div>
        </label>

        <label>Phone
          <div class="input-shell" [class.invalid]="phone && !isNigeriaPhone(phone)">
            <ion-icon name="call-outline"></ion-icon>
            <ion-input [(ngModel)]="phone" name="phone" type="tel" autocomplete="tel" placeholder="Enter account phone"></ion-input>
          </div>
        </label>

        <label>Emergency contact phone
          <div class="input-shell" [class.invalid]="emergencyContactPhone && !isNigeriaPhone(emergencyContactPhone)">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <ion-input [(ngModel)]="emergencyContactPhone" name="emergencyContactPhone" type="tel" placeholder="Enter saved emergency contact"></ion-input>
          </div>
        </label>

        <p class="hint">Use the emergency contact phone saved on your driver or employer profile.</p>

        <div class="error-box" *ngIf="error">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <ion-note color="danger">{{ error }}</ion-note>
        </div>

        <ion-button expand="block" class="primary-btn" [disabled]="busy" (click)="verifyAccount()">
          <ion-spinner *ngIf="busy" name="crescent"></ion-spinner>
          <span>{{ busy ? 'Checking...' : 'Verify account' }}</span>
        </ion-button>
      </ng-container>

      <ng-template #resetForm>
        <label>New password
          <div class="input-shell">
            <ion-icon name="lock-closed-outline"></ion-icon>
            <ion-input [(ngModel)]="password" name="password" [type]="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Minimum 6 characters"></ion-input>
            <button type="button" class="toggle-btn" (click)="showPassword = !showPassword" aria-label="Toggle password visibility">
              <ion-icon [name]="showPassword ? 'eye-outline' : 'eye-off-outline'"></ion-icon>
            </button>
          </div>
        </label>

        <label>Confirm password
          <div class="input-shell">
            <ion-icon name="lock-closed-outline"></ion-icon>
            <ion-input [(ngModel)]="confirmPassword" name="confirmPassword" [type]="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Repeat new password"></ion-input>
          </div>
        </label>

        <div class="error-box" *ngIf="error">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <ion-note color="danger">{{ error }}</ion-note>
        </div>

        <ion-button expand="block" class="primary-btn" [disabled]="busy" (click)="resetPassword()">
          <ion-spinner *ngIf="busy" name="crescent"></ion-spinner>
          <span>{{ busy ? 'Saving...' : 'Change password' }}</span>
        </ion-button>
      </ng-template>
    </section>

    <ng-template #successState>
      <section class="form-panel success-panel">
        <ion-icon name="checkmark-circle-outline"></ion-icon>
        <h2>Password changed</h2>
        <p>{{ message }}</p>
        <ion-button expand="block" class="primary-btn" (click)="goToLogin()">Sign in</ion-button>
      </section>
    </ng-template>
  </main>
</ion-content>
  `,
  styles: [`
:host { display:block; --gold:#c39454; --navy:#061b38; --ink:#07162e; --muted:#687386; --line:#e2e5ea; }
.forgot-content { --background:#fff; }
.forgot-content::part(scroll) { overflow-x:hidden; }
.forgot-screen { min-height:100dvh; padding:calc(env(safe-area-inset-top) + 18px) 22px calc(env(safe-area-inset-bottom) + 26px); background:linear-gradient(180deg,#fbf8f2 0%,#fff 42%); color:var(--ink); }
.back-btn { width:46px; height:46px; border:0; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.94); color:var(--navy); box-shadow:0 10px 24px rgba(7,22,46,.1); font-size:24px; }
.brand-panel { padding:34px 0 22px; }
.brand-panel img { display:block; width:132px; height:auto; object-fit:contain; margin-bottom:30px; }
.brand-panel p { margin:0 0 7px; color:var(--gold); font-size:12px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
.brand-panel h1 { margin:0; max-width:310px; color:var(--navy); font-size:34px; line-height:1.08; font-weight:900; letter-spacing:0; }
.brand-panel span { display:block; width:46px; height:3px; margin-top:17px; border-radius:20px; background:linear-gradient(135deg,#c39454,#d8b77a); }
.form-panel { display:grid; gap:18px; }
label { display:grid; gap:8px; color:var(--ink); font-size:14px; font-weight:800; }
.input-shell { min-height:60px; display:flex; align-items:center; gap:10px; padding:0 14px; border:1.5px solid var(--line); border-radius:16px; background:#fbfcfe; }
.input-shell:focus-within { border-color:rgba(195,148,84,.72); box-shadow:0 0 0 4px rgba(195,148,84,.09); background:#fff; }
.input-shell.invalid { border-color:#f04438; background:#fff7f6; }
.input-shell ion-icon { flex:0 0 auto; color:var(--navy); font-size:22px; }
ion-input { --padding-start:0; --padding-end:0; --color:var(--ink); --placeholder-color:#a6adba; --placeholder-opacity:1; font-size:15px; }
.toggle-btn { width:38px; height:38px; border:0; background:transparent; color:#687386; display:grid; place-items:center; font-size:20px; }
.hint { margin:-6px 2px 0; color:var(--muted); font-size:12px; line-height:1.45; }
.error-box { display:flex; gap:8px; align-items:flex-start; padding:11px 13px; border-radius:12px; background:rgba(217,45,32,.06); }
.error-box ion-icon { color:#d92d20; font-size:18px; margin-top:1px; }
.error-box ion-note { font-size:13px; line-height:1.4; }
.primary-btn { height:62px; margin-top:2px; --border-radius:17px; --background:linear-gradient(135deg,#061b38,#0d315c); --background-activated:#061b38; --color:#fff; --box-shadow:0 12px 28px rgba(7,22,46,.18); text-transform:none; font-size:16px; font-weight:800; }
.primary-btn ion-spinner { width:19px; height:19px; margin-right:9px; color:#fff; }
.success-panel { margin-top:8px; justify-items:center; text-align:center; padding:28px 12px 0; }
.success-panel > ion-icon { color:#12805c; font-size:68px; }
.success-panel h2 { margin:2px 0 0; color:var(--navy); font-size:25px; }
.success-panel p { margin:0 0 8px; color:var(--muted); font-size:14px; line-height:1.5; }
@media (min-width: 760px) { .forgot-screen { width:min(480px,100%); margin:0 auto; box-shadow:0 0 60px rgba(15,23,42,.1); } }
  `],
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  phone = '';
  emergencyContactPhone = '';
  password = '';
  confirmPassword = '';
  resetToken = '';
  error = '';
  message = '';
  busy = false;
  verified = false;
  done = false;
  showPassword = false;

  isNigeriaPhone(value: string) {
    return isValidNigeriaPhone(value);
  }

  back() {
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  async verifyAccount() {
    if (this.busy) return;
    this.error = '';
    if (!this.email.trim() || !this.phone.trim() || !this.emergencyContactPhone.trim()) {
      this.error = 'Enter your email, phone number, and emergency contact phone.';
      return;
    }
    if (!isValidNigeriaPhone(this.phone) || !isValidNigeriaPhone(this.emergencyContactPhone)) {
      this.error = NIGERIA_PHONE_ERROR;
      return;
    }
    this.busy = true;
    try {
      const result = await this.auth.verifyForgotPassword({
        email: this.email.trim(),
        phone: this.phone.trim(),
        emergencyContactPhone: this.emergencyContactPhone.trim(),
      });
      this.resetToken = result.resetToken;
      this.message = result.message;
      this.verified = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not verify this account.';
    } finally {
      this.busy = false;
    }
  }

  async resetPassword() {
    if (this.busy) return;
    this.error = '';
    if (!this.password || this.password.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    this.busy = true;
    try {
      const result = await this.auth.resetForgotPassword({ resetToken: this.resetToken, password: this.password });
      this.message = result.message;
      this.done = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not change password.';
    } finally {
      this.busy = false;
    }
  }

  goToLogin() {
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
