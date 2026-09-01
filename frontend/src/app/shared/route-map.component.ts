import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import * as L from 'leaflet';

export type RouteCoordinate = { latitude: number; longitude: number } | null | undefined;

@Component({
  selector: 'app-route-map',
  standalone: true,
  imports: [CommonModule],
  template: `
<section class="route-map-shell">
  <div class="route-map-header">
    <div>
      <p>{{ eyebrow }}</p>
      <h3>{{ title }}</h3>
    </div>
    <span [class.live]="isLive">{{ statusLabel }}</span>
  </div>
  <div #mapHost class="route-map" [class.pending]="!hasCoordinates" [style.height]="mapHeight"></div>
  <div class="route-map-empty" *ngIf="!hasCoordinates">
    <strong>Location pending</strong>
    <small>Driver and pickup coordinates are required to show the live route.</small>
  </div>
  <div class="route-map-meta" *ngIf="hasCoordinates">
    <span><i class="driver-dot"></i>{{ driverLabel }}</span>
    <span><i class="pickup-dot"></i>{{ pickupLabel }}</span>
  </div>
</section>
  `,
  styles: [`
.route-map-shell { position:relative; overflow:hidden; margin:12px 0; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; background:var(--admin-card,#fff); box-shadow:0 10px 26px rgba(15,23,42,.06); }
.route-map-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 12px 10px; }
.route-map-header p { margin:0; color:#1954d1; font-size:10px; font-weight:900; text-transform:uppercase; }
.route-map-header h3 { margin:2px 0 0; color:var(--admin-text,#101828); font-size:15px; }
.route-map-header span { flex:0 0 auto; border-radius:999px; padding:5px 8px; color:#475569; background:#e2e8f0; font-size:10px; font-weight:900; text-transform:uppercase; }
.route-map-header span.live { color:#166534; background:#dcfce7; }
.route-map { position:relative; z-index:1; width:100%; height:260px; background:#eaf1f9; }
.route-map.pending { filter:saturate(.75); }
.route-map-empty { position:absolute; left:50%; top:56%; z-index:2; display:grid; justify-items:center; gap:4px; width:min(280px,calc(100% - 34px)); padding:14px; border:1px solid rgba(148,163,184,.28); border-radius:8px; background:rgba(255,255,255,.92); color:#172033; text-align:center; transform:translate(-50%,-50%); box-shadow:0 12px 30px rgba(15,23,42,.14); }
.route-map-empty strong { font-size:14px; }
.route-map-empty small { color:#64748b; font-size:11px; line-height:1.35; }
.route-map-meta { display:flex; flex-wrap:wrap; gap:10px; padding:10px 12px 12px; color:var(--admin-muted,#667085); font-size:11px; font-weight:800; }
.route-map-meta span { display:inline-flex; align-items:center; gap:6px; }
.route-map-meta i { width:10px; height:10px; border-radius:50%; box-shadow:0 0 0 4px rgba(15,23,42,.08); }
.driver-dot { background:#1954d1; }
.pickup-dot { background:#16a34a; }
:host-context(body.dark-theme) .route-map-shell { background:#0d1420; border-color:rgba(255,255,255,.1); }
:host-context(body.dark-theme) .route-map-header h3 { color:#f8fafc; }
:host-context(body.dark-theme) .route-map-empty { background:rgba(13,20,32,.92); color:#f8fafc; border-color:rgba(255,255,255,.12); }
:host-context(body.dark-theme) .route-map-empty small { color:#b7c0cf; }
@media (max-width:560px) { .route-map { height:230px; } .route-map-header { align-items:flex-start; flex-direction:column; } }
  `],
})
export class RouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() driverCoordinates: RouteCoordinate = null;
  @Input() pickupCoordinates: RouteCoordinate = null;
  @Input() title = 'Live route';
  @Input() eyebrow = 'Route map';
  @Input() status = '';
  @Input() driverLabel = 'Driver';
  @Input() pickupLabel = 'Pickup';
  @Input() mapHeight = '260px';
  @ViewChild('mapHost') private mapHost?: ElementRef<HTMLElement>;

  private map?: L.Map;
  private routeLayer?: L.Polyline;
  private markerLayer = L.layerGroup();
  private routeRequest = 0;

  get hasCoordinates() {
    return Boolean(this.asLatLng(this.driverCoordinates) && this.asLatLng(this.pickupCoordinates));
  }

  get isLive() {
    return this.status === 'started';
  }

  get statusLabel() {
    return this.status ? this.status : 'pending';
  }

  ngAfterViewInit() {
    this.setupMap();
    void this.renderRoute();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.map) return;
    if (changes['driverCoordinates'] || changes['pickupCoordinates'] || changes['status']) void this.renderRoute();
  }

  ngOnDestroy() {
    this.routeRequest += 1;
    this.map?.remove();
  }

  private setupMap() {
    if (!this.mapHost || this.map) return;
    this.map = L.map(this.mapHost.nativeElement, { zoomControl: false, attributionControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(this.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);
    this.markerLayer.addTo(this.map);
    this.map.setView([6.5244, 3.3792], 11);
  }

  private async renderRoute() {
    this.setupMap();
    if (!this.map) return;
    window.setTimeout(() => this.map?.invalidateSize(), 80);
    this.markerLayer.clearLayers();
    this.routeLayer?.remove();
    this.routeLayer = undefined;

    const driver = this.asLatLng(this.driverCoordinates);
    const pickup = this.asLatLng(this.pickupCoordinates);
    if (!driver || !pickup) return;

    const driverIcon = this.markerIcon('#1954d1', 'Driver');
    const pickupIcon = this.markerIcon('#16a34a', 'Pickup');
    L.marker(driver, { icon: driverIcon }).bindTooltip(this.driverLabel).addTo(this.markerLayer);
    L.marker(pickup, { icon: pickupIcon }).bindTooltip(this.pickupLabel).addTo(this.markerLayer);

    const requestId = ++this.routeRequest;
    const points = await this.fetchRoute(driver, pickup).catch(() => [driver, pickup]);
    if (requestId !== this.routeRequest || !this.map) return;

    this.routeLayer = L.polyline(points, { color: '#1954d1', weight: 5, opacity: 0.88, lineCap: 'round', lineJoin: 'round' }).addTo(this.map);
    this.map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 15 });
  }

  private async fetchRoute(from: L.LatLngExpression, to: L.LatLngExpression): Promise<L.LatLngExpression[]> {
    const start = L.latLng(from);
    const end = L.latLng(to);
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return [from, to];
    const data = await response.json() as { routes?: { geometry?: { coordinates?: [number, number][] } }[] };
    const coordinates = data.routes?.[0]?.geometry?.coordinates || [];
    return coordinates.length ? coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression) : [from, to];
  }

  private asLatLng(value: RouteCoordinate): L.LatLngExpression | null {
    if (!value || !Number.isFinite(Number(value.latitude)) || !Number.isFinite(Number(value.longitude))) return null;
    return [Number(value.latitude), Number(value.longitude)];
  }

  private markerIcon(color: string, label: string) {
    return L.divIcon({
      className: '',
      html: `<span aria-label="${label}" style="display:block;width:18px;height:18px;border:4px solid #fff;border-radius:50%;background:${color};box-shadow:0 8px 20px rgba(15,23,42,.3),0 0 0 5px ${color}33;"></span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }
}
