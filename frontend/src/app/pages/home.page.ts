import { Component } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';

@Component({ standalone: true, imports: [IonButton, IonContent, IonHeader, IonTitle, IonToolbar, RouterLink], template: `
<ion-header><ion-toolbar color="primary"><ion-title>Verified Dispatch</ion-title></ion-toolbar></ion-header>
<ion-content><main class="page-shell"><section class="hero"><p class="eyebrow">Trusted mobility operations</p><h1>Emergency-ready drivers, verified before assignment.</h1><p>Dispatch verified drivers for emergency response, ride-hailing, logistics, chauffeur work, and field-service operations.</p><div class="actions"><ion-button color="light" routerLink="/login">Sign in</ion-button><ion-button fill="outline" color="light" routerLink="/register">Create account</ion-button></div></section><section class="grid" style="margin-top:24px"><article class="card"><h2>Verified supply</h2><p class="muted">Confirm identity, location, and availability before every assignment.</p></article><article class="card"><h2>Fast dispatch</h2><p class="muted">Give operations teams a clear path from request to driver assignment.</p></article><article class="card"><h2>Cross-platform</h2><p class="muted">One Angular and Ionic codebase for web, iOS, and Android.</p></article></section></main></ion-content>` })
export class HomePage {}
