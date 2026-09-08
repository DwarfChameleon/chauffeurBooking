import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonNote,
  IonSpinner
} from '@ionic/angular/standalone';

import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonNote,
    IonSpinner
  ],

  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})

export class LoginPage {

  contact = '';
  password = '';

  error = '';

  busy = false;
  googleBusy = false;

  showPassword = false;


  private readonly auth =
    inject(AuthService);

  private readonly router =
    inject(Router);


  /* ==============================
     EXISTING BACK LOGIC
  ============================== */

  back(): void {

    void this.router.navigateByUrl('/');

  }


  /* ==============================
     PASSWORD VISIBILITY
  ============================== */

  togglePassword(): void {

    this.showPassword =
      !this.showPassword;

  }


  /* ==============================
     YOUR EXISTING LOGIN LOGIC
  ============================== */

  async submit(): Promise<void> {

    if (this.busy) {
      return;
    }


    this.error = '';


    if (
      !this.contact.trim() ||
      !this.password
    ) {

      this.error =
        'Enter your email or phone number and password.';

      return;

    }


    this.busy = true;


    try {

      const session =
        await this.auth.login(
          this.contact.trim(),
          this.password
        );


      await this.router.navigateByUrl(
        this.auth.dashboardFor(
          session.user.role
        )
      );

    }

    catch (e) {

      this.error =
        e instanceof Error
          ? e.message
          : 'Unable to sign in';

    }

    finally {

      this.busy = false;

    }

  }


  /* ==============================
     FORGOT PASSWORD
  ============================== */

  forgotPassword(): void {

    void this.router.navigateByUrl(
      '/forgot-password'
    );

  }


  /* ==============================
     GOOGLE LOGIN

     Supports an AuthService method
     named loginWithGoogle().

     It does NOT interfere with your
     normal login method.
  ============================== */

  async googleSignIn(): Promise<void> {

    if (this.googleBusy) {
      return;
    }


    this.error = '';

    this.googleBusy = true;


    try {

      /*
       * We don't know yet whether your
       * AuthService already contains
       * Google authentication.
       *
       * This checks for it safely without
       * breaking your existing AuthService.
       */

      const auth =
        this.auth as AuthService & {

          loginWithGoogle?: () =>
            Promise<any>;

        };


      if (!auth.loginWithGoogle) {

        throw new Error(
          'Google sign in is not configured yet.'
        );

      }


      const session =
        await auth.loginWithGoogle();


      if (
        session?.user?.role
      ) {

        await this.router.navigateByUrl(

          this.auth.dashboardFor(
            session.user.role
          )

        );

      }

    }

    catch (e) {

      this.error =
        e instanceof Error
          ? e.message
          : 'Unable to sign in with Google';

    }

    finally {

      this.googleBusy = false;

    }

  }

}
