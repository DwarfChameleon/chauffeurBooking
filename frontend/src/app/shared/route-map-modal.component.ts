import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { RouteCoordinate, RouteMapComponent } from './route-map.component';

@Component({
  selector: 'app-route-map-modal',
  standalone: true,
  imports: [CommonModule, IonIcon, IonModal, RouteMapComponent],
  template: `
<ion-modal class="route-map-modal" [isOpen]="isOpen" [initialBreakpoint]="0.88" [breakpoints]="[0, 0.72, 0.88, 1]" handle="true" handleBehavior="drag" (didPresent)="refreshMap()" (didDismiss)="close.emit()">
  <ng-template>
    <section class="map-modal-shell">
      <header>
        <div>
          <p>Live dispatch route</p>
          <h2>{{ modalTitle }}</h2>
        </div>
        <button type="button" (click)="close.emit()" aria-label="Close live map" title="Close"><ion-icon name="close-outline"></ion-icon></button>
      </header>
      <app-route-map
        [driverCoordinates]="driverCoordinates"
        [pickupCoordinates]="pickupCoordinates"
        [status]="status"
        [driverLabel]="driverLabel"
        [pickupLabel]="pickupLabel"
        [destinationLabel]="destinationLabel"
        [title]="routeTitle"
        eyebrow="Leaflet route"
        mapHeight="calc(100vh - 210px)">
      </app-route-map>
    </section>
  </ng-template>
</ion-modal>
  `,
  styles: [`
ion-modal.route-map-modal { --height:100vh; --max-height:100vh; --width:100vw; --border-radius:18px 18px 0 0; align-items:end; }
.map-modal-shell { min-height:100%; box-sizing:border-box; padding:18px; background:var(--map-modal-bg,#f5f8fc); color:var(--map-modal-text,#101828); }
header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:12px; }
header p { margin:0 0 5px; color:#1954d1; font-size:11px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
header h2 { margin:0; color:var(--map-modal-text,#101828); font-size:22px; line-height:1.15; }
button { display:grid; place-items:center; width:42px; height:42px; flex:0 0 auto; border:0; border-radius:50%; color:var(--map-modal-text,#172033); background:rgba(148,163,184,.18); cursor:pointer; }
button ion-icon { color:currentColor; font-size:22px; }
:host-context(body.dark-theme) .map-modal-shell,
:host-context(body.driver-dark-theme) .map-modal-shell { --map-modal-bg:#070b13; --map-modal-text:#f8fafc; }
:host-context(body.dark-theme) button,
:host-context(body.driver-dark-theme) button { background:rgba(255,255,255,.1); }
@media (max-width:560px) { .map-modal-shell { padding:14px; } header h2 { font-size:19px; } }
  `],
})
export class RouteMapModalComponent {
  private readonly auth = inject(AuthService);
  @ViewChild(RouteMapComponent) private routeMap?: RouteMapComponent;
  @Input() isOpen = false;
  @Input() driverCoordinates: RouteCoordinate = null;
  @Input() pickupCoordinates: RouteCoordinate = null;
  @Input() status = '';
  @Input() driverLabel = 'Driver';
  @Input() pickupLabel = 'Pickup';
  @Input() destinationLabel = '';
  @Input() routeTitle = 'Requested route';
  @Output() close = new EventEmitter<void>();

  get modalTitle() {
    const user = this.auth.session()?.user;
    const raw = user?.name || user?.email || user?.phone || 'User';
    const firstName = String(raw).trim().split(/[\s@]+/)[0] || 'User';
    return `${firstName} Live Map`;
  }

  refreshMap() {
    this.routeMap?.refresh();
  }
}
