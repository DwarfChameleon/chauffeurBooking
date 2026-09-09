import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, IonButton, IonContent, IonIcon],
  templateUrl: './registration-success.page.html',
  styleUrl: './registration-success.page.scss'
})
export class RegistrationSuccessPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  get isDriver() {
    return this.auth.session()?.user.role === 'driver';
  }

  completeProfile() {
    void this.router.navigateByUrl('/driver/profile/edit');
  }

  bookChauffeur() {
    void this.router.navigateByUrl('/book-driver');
  }

  goToDashboard() {
    void this.router.navigateByUrl(this.auth.dashboardFor(this.auth.session()?.user.role));
  }
}
