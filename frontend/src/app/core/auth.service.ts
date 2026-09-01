import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

export interface SessionUser { id?: string; name?: string; email?: string; phone?: string; role?: string; }
export interface Session { token: string; user: SessionUser; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'verified-dispatch-session';
  readonly session = signal<Session | null>(this.read());
  constructor(private readonly api: ApiService, private readonly router: Router) {}
  async login(contact: string, password: string) { const result = await this.api.post<Session>('/auth/login', { email: contact, password }); this.save(result); return result; }
  async register(data: Record<string, unknown>) { const result = await this.api.post<Session>('/auth/register', data); this.save(result); return result; }
  logout() { localStorage.removeItem(this.storageKey); this.session.set(null); void this.router.navigateByUrl('/'); }
  dashboardFor(role?: string) { return role === 'admin' ? '/admin/dashboard' : role === 'driver' ? '/driver/dashboard' : '/employer/dashboard'; }
  private save(value: Session) { localStorage.setItem(this.storageKey, JSON.stringify(value)); this.session.set(value); }
  private read(): Session | null { try { return JSON.parse(localStorage.getItem(this.storageKey) || 'null') as Session | null; } catch { return null; } }
}
