import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonNote],
  templateUrl: './admin-login.page.html',
  styleUrl: './admin-login.page.scss'
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
