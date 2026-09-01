import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders, HttpResponse } from '@angular/common/http';
import { filter, firstValueFrom, lastValueFrom, map, tap } from 'rxjs';

const API_PORT = '5000';
const API_PATH = '/api';
const API_URL = resolveApiUrl();

function resolveApiUrl() {
  const configuredUrl = (globalThis as { __env?: { apiUrl?: string } }).__env?.apiUrl;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const currentLocation = globalThis.location;
  const protocol = currentLocation?.protocol?.startsWith('http') ? currentLocation.protocol : 'http:';
  const hostname = currentLocation?.hostname && currentLocation.hostname !== '0.0.0.0' ? currentLocation.hostname : 'localhost';

  return `${protocol}//${hostname}:${API_PORT}${API_PATH}`;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private headers(token?: string) { return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined; }
  get<T>(path: string, token?: string) { return firstValueFrom(this.http.get<T>(`${API_URL}${path}`, { headers: this.headers(token) })); }
  post<T>(path: string, body: unknown, token?: string) { return firstValueFrom(this.http.post<T>(`${API_URL}${path}`, body, { headers: this.headers(token) })); }
  patch<T>(path: string, body: unknown, token?: string) { return firstValueFrom(this.http.patch<T>(`${API_URL}${path}`, body, { headers: this.headers(token) })); }
  delete<T>(path: string, token?: string) { return firstValueFrom(this.http.delete<T>(`${API_URL}${path}`, { headers: this.headers(token) })); }
  upload<T>(path: string, file: File, token?: string) { const body = new FormData(); body.append('file', file); return firstValueFrom(this.http.post<T>(`${API_URL}${path}`, body, { headers: this.headers(token) })); }
  uploadWithProgress<T>(path: string, file: File, token: string | undefined, onProgress: (percent: number) => void) { const body = new FormData(); body.append('file', file); return lastValueFrom(this.http.post<T>(`${API_URL}${path}`, body, { headers: this.headers(token), observe: 'events', reportProgress: true }).pipe(tap((event) => { if (event.type === HttpEventType.UploadProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100)); }), filter((event): event is HttpResponse<T> => event.type === HttpEventType.Response), map((event) => event.body as T))); }
}
