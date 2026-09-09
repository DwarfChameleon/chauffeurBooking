import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonNote, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth.service';
import { NIGERIA_PHONE_ERROR, isValidNigeriaPhone } from '../../core/nigeria-phone';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon, IonInput, IonNote, IonSpinner],
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.scss'
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
