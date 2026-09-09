import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth.service';
import { NIGERIA_PHONE_ERROR, isValidNigeriaPhone } from '../../core/nigeria-phone';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonTitle, IonToolbar],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss'
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
