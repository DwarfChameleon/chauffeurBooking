import { CommonModule, Location } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonFooter, IonIcon } from '@ionic/angular/standalone';

type EmployerTab = 'dashboard' | 'chauffeurs' | 'bookings' | 'profile';

@Component({
  selector: 'app-employer-nav',
  standalone: true,
  imports: [CommonModule, IonFooter, IonIcon],
  template: `
<ion-footer>
  <nav class="bottom-nav" aria-label="Employer navigation">
    <button class="nav-item" [class.active]="active === 'dashboard'" type="button" (click)="navigate('/employer/dashboard')"><ion-icon name="grid-outline"></ion-icon><span>Dashboard</span></button>
    <button class="nav-item" [class.active]="active === 'chauffeurs'" type="button" (click)="navigate('/employer/chauffeurs')"><ion-icon name="car-sport-outline"></ion-icon><span>Chauffeurs</span></button>
    <button class="nav-item" [class.active]="active === 'bookings'" type="button" (click)="navigate('/book-driver')"><ion-icon name="calendar-outline"></ion-icon><span>Bookings</span></button>
    <button class="nav-item" [class.active]="active === 'profile'" type="button" (click)="navigate('/employer/profile')"><ion-icon name="person-circle-outline"></ion-icon><span>Profile</span></button>
  </nav>
</ion-footer>
  `,
  styles: [`
.bottom-nav { display:flex; align-items:center; justify-content:center; gap:8px; min-height:72px; border-top:1px solid #e7edf5; background:#fff; padding:5px max(10px, env(safe-area-inset-left)) max(7px, env(safe-area-inset-bottom)); }
.nav-item { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; min-width:112px; min-height:54px; border:0; border-radius:8px; background:transparent; color:#728096; font:inherit; font-size:10px; font-weight:800; cursor:pointer; }
.nav-item ion-icon { font-size:22px; }
.nav-item.active { color:var(--app-primary); background:rgba(var(--app-primary-rgb),.12); }
@media (max-width:620px) { .bottom-nav { justify-content:space-around; gap:4px; } .nav-item { min-width:0; flex:1; } }
  `],
})
export class EmployerNavComponent {
  @Input() active: EmployerTab = 'dashboard';
  @Output() navigationAttempt = new EventEmitter<string>();
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  navigate(path: string) {
    if (this.navigationAttempt.observed) this.navigationAttempt.emit(path);
    else void this.router.navigateByUrl(path);
  }

  back(fallback = '/employer/dashboard') {
    if (globalThis.history.length > 1) this.location.back();
    else void this.router.navigateByUrl(fallback);
  }
}
