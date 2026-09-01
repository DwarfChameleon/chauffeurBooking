import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

@Component({ standalone: true, imports: [CommonModule, FormsModule, RouterLink, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonNote, IonTitle, IonToolbar], template: `
<ion-header class="auth-header"><ion-toolbar><ion-buttons slot="start"><ion-button fill="clear" (click)="back()"><ion-icon name="arrow-back-outline" slot="icon-only"></ion-icon></ion-button></ion-buttons><ion-title>Sign in</ion-title></ion-toolbar></ion-header><ion-content><main class="page-shell"><section class="card form-card"><p class="eyebrow">Secure Access</p><h1>Welcome back</h1><ion-item><ion-label position="stacked">Email or phone</ion-label><ion-input [(ngModel)]="contact" autocomplete="username" /></ion-item><ion-item><ion-label position="stacked">Password</ion-label><ion-input [(ngModel)]="password" type="password" autocomplete="current-password" /></ion-item><ion-note color="danger" *ngIf="error">{{ error }}</ion-note><ion-button expand="block" (click)="submit()" [disabled]="busy">{{ busy ? 'Signing in...' : 'Sign in' }}</ion-button><p class="muted">New to the network? <a routerLink="/register">Create an account</a></p></section></main></ion-content>`,
styles: [`
:host { display:block; --ink:#172033; --blue:#1954d1; }
.auth-header { background:transparent; box-shadow:none; border:0; }
.auth-header::after { display:none; }
ion-toolbar { --background:transparent; --border-width:0; --box-shadow:none; color:var(--ink); }
ion-title { font-size:16px; font-weight:900; }
.auth-header ion-button { --color:var(--blue); margin:0; }
.page-shell { padding-top:50px; }
`] })
export class LoginPage {
  contact = ''; password = ''; error = ''; busy = false; private readonly auth = inject(AuthService); private readonly router = inject(Router);
  back() { void this.router.navigateByUrl('/'); }
  async submit() { this.busy = true; this.error = ''; try { const session = await this.auth.login(this.contact, this.password); await this.router.navigateByUrl(this.auth.dashboardFor(session.user.role)); } catch (e) { this.error = e instanceof Error ? e.message : 'Unable to sign in'; } finally { this.busy = false; } }
}
