import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';

@Component({
  standalone: true,
  imports: [IonContent, IonIcon],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePage {
  constructor(private readonly router: Router) {}

  goToSignIn(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  goToRegister(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.router.navigateByUrl('/register', { replaceUrl: true });
  }
}
