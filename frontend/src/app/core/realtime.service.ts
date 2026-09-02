import { Injectable, NgZone, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from './api.service';

export type RealtimeEvent =
  | { kind: 'booking'; bookingId: string; status: string; reason: string }
  | { kind: 'notification'; id: string; title: string; body: string; read: boolean };

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly zone = inject(NgZone);
  private socket: Socket | null = null;
  private readonly eventsSubject = new Subject<RealtimeEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  connect(token: string) {
    if (this.socket?.connected) return;
    this.socket?.disconnect();
    this.socket = io(API_ORIGIN, { auth: { token }, transports: ['websocket', 'polling'] });
    this.socket.on('booking:updated', (event: { bookingId: string; status: string; reason: string }) => this.zone.run(() => this.eventsSubject.next({ kind: 'booking', ...event })));
    this.socket.on('notification:new', (event: { id: string; title: string; body: string; read: boolean }) => this.zone.run(() => this.eventsSubject.next({ kind: 'notification', ...event })));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
