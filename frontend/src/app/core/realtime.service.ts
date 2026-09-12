import { Injectable, NgZone, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from './api.service';
import { AdminCallLog } from '../pages/admin-types';

export type RealtimeEvent =
  | { kind: 'booking'; bookingId: string; status: string; reason: string }
  | { kind: 'notification'; id: string; title: string; body: string; read: boolean }
  | { kind: 'call-ring'; call: LiveCallSession }
  | { kind: 'call-started'; call: LiveCallSession }
  | { kind: 'call-response'; sessionId: string; bookingId: string; userId: string; accepted: boolean; at: string }
  | { kind: 'call-ended'; sessionId: string; bookingId: string; endedBy: string; at: string }
  | { kind: 'call-signal'; sessionId: string; bookingId: string; fromUserId: string; signal: unknown }
  | { kind: 'call-log-updated'; call: AdminCallLog };

export type LiveCallTarget = 'driver' | 'employer' | 'conference' | 'support';

export interface LiveCallSession {
  id: string;
  bookingId: string;
  target: LiveCallTarget;
  state: 'ringing' | 'accepted' | 'declined' | 'ended';
  callerName: string;
  callerId: string;
  bookingLabel: string;
  participantCount: number;
  createdAt: string;
  startedAt?: string;
}

type SocketAck<T> = { ok: true; message?: string } & T | { ok: false; message: string };

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
    this.socket.on('call:ring', (call: LiveCallSession) => this.zone.run(() => this.eventsSubject.next({ kind: 'call-ring', call })));
    this.socket.on('call:started', (call: LiveCallSession) => this.zone.run(() => this.eventsSubject.next({ kind: 'call-started', call })));
    this.socket.on('call:participant-response', (event: { sessionId: string; bookingId: string; userId: string; accepted: boolean; at: string }) => this.zone.run(() => this.eventsSubject.next({ kind: 'call-response', ...event })));
    this.socket.on('call:ended', (event: { sessionId: string; bookingId: string; endedBy: string; at: string }) => this.zone.run(() => this.eventsSubject.next({ kind: 'call-ended', ...event })));
    this.socket.on('call:signal', (event: { sessionId: string; bookingId: string; fromUserId: string; signal: unknown }) => this.zone.run(() => this.eventsSubject.next({ kind: 'call-signal', ...event })));
    this.socket.on('call:log-updated', (call: AdminCallLog) => this.zone.run(() => this.eventsSubject.next({ kind: 'call-log-updated', call })));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  initiateBookingCall(bookingId: string, target: LiveCallTarget) {
    return this.emitWithAck<{ call: LiveCallSession }>('call:initiate', { bookingId, target });
  }

  initiateSupportCall() {
    return this.emitWithAck<{ call: LiveCallSession }>('call:support', {});
  }

  respondToCall(sessionId: string, accepted: boolean) {
    return this.emitWithAck<{ call: LiveCallSession }>('call:respond', { sessionId, accepted });
  }

  endCall(sessionId: string) {
    return this.emitWithAck<Record<string, never>>('call:end', { sessionId });
  }

  sendCallSignal(sessionId: string, toUserId: string, signal: unknown) {
    return this.emitWithAck<Record<string, never>>('call:signal', { sessionId, toUserId, signal });
  }

  private emitWithAck<T>(eventName: string, payload: unknown) {
    if (!this.socket?.connected) return Promise.reject(new Error('Realtime connection is not ready. Please try again.'));

    return new Promise<SocketAck<T>>((resolve) => {
      this.socket?.timeout(9000).emit(eventName, payload, (error: Error | null, response: SocketAck<T>) => {
        if (error) resolve({ ok: false, message: 'Realtime request timed out. Please try again.' });
        else resolve(response);
      });
    }).then((response) => {
      if (!response.ok) throw new Error(response.message);
      return response;
    });
  }
}
