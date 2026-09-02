import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEventType, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, catchError, filter, firstValueFrom, lastValueFrom, map, switchMap, tap, throwError } from 'rxjs';

const API_PORT = '5000';
const API_PATH = '/api';
export const API_URL = resolveApiUrl();
export const API_ORIGIN = resolveApiOrigin(API_URL);
const FALLBACK_API_URL = resolveFallbackApiUrl(API_URL);
const OFFLINE_MESSAGE = 'No internet connection. Please check your network and try again.';
const SERVER_UNREACHABLE_MESSAGE = 'Could not connect to the server. Please check your connection and try again.';
const LOGIN_AGAIN_MESSAGE = 'Please log in again to continue.';
const SESSION_STORAGE_KEY = 'verified-dispatch-session';

type RuntimeEnv = { __env?: { apiUrl?: string; fallbackApiUrl?: string } };
type StoredSession = { token?: string; refreshToken?: string; user?: unknown };

function resolveApiUrl() {
  const configuredUrl = (globalThis as RuntimeEnv).__env?.apiUrl;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  return resolveLocalApiUrl();
}

function resolveFallbackApiUrl(primaryUrl: string) {
  const configuredFallback = (globalThis as RuntimeEnv).__env?.fallbackApiUrl;
  const fallback = configuredFallback ? configuredFallback.replace(/\/$/, '') : resolveLocalApiUrl();
  return fallback !== primaryUrl ? fallback : '';
}

function resolveApiOrigin(apiUrl: string) {
  try {
    const url = new URL(apiUrl);
    url.pathname = url.pathname.replace(/\/api\/?$/, '') || '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
}

function resolveLocalApiUrl() {
  const currentLocation = globalThis.location;
  const protocol = currentLocation?.protocol?.startsWith('http') ? currentLocation.protocol : 'http:';
  const hostname = currentLocation?.hostname && currentLocation.hostname !== '0.0.0.0' ? currentLocation.hostname : 'localhost';

  return `${protocol}//${hostname}:${API_PORT}${API_PATH}`;
}

function isNetworkError(error: unknown) {
  return error instanceof HttpErrorResponse && error.status === 0;
}

function normalizeApiError(error: unknown) {
  if (isNetworkError(error)) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return new Error(offline ? OFFLINE_MESSAGE : SERVER_UNREACHABLE_MESSAGE);
  }
  if (error instanceof HttpErrorResponse) {
    const message = typeof error.error?.message === 'string' ? error.error.message : error.message;
    if (error.status === 401 && /invalid|expired|auth|token/i.test(message)) return new Error(LOGIN_AGAIN_MESSAGE);
    return new Error(message || 'Request failed. Please try again.');
  }
  return error instanceof Error ? error : new Error('Request failed. Please try again.');
}

function normalizeResourceUrl(value: string) {
  if (!value) return value;
  if (value.startsWith('/uploads/')) return `${API_ORIGIN}${value}`;

  try {
    const url = new URL(value);
    const isUpload = url.pathname.startsWith('/uploads/');
    const isLocalBackend = ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) && url.port === API_PORT;
    return isUpload && isLocalBackend ? `${API_ORIGIN}${url.pathname}${url.search}${url.hash}` : value;
  } catch {
    return value;
  }
}

function normalizeApiPayload<T>(payload: T): T {
  if (typeof payload === 'string') return normalizeResourceUrl(payload) as T;
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map((item) => normalizeApiPayload(item)) as T;

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    normalized[key] = normalizeApiPayload(value);
  }
  return normalized as T;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private headers(token?: string) { return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined; }
  get<T>(path: string, token?: string) { return firstValueFrom(this.request<T>('get', path, undefined, token)); }
  post<T>(path: string, body: unknown, token?: string) { return firstValueFrom(this.request<T>('post', path, body, token)); }
  patch<T>(path: string, body: unknown, token?: string) { return firstValueFrom(this.request<T>('patch', path, body, token)); }
  delete<T>(path: string, token?: string) { return firstValueFrom(this.request<T>('delete', path, undefined, token)); }
  upload<T>(path: string, file: File, token?: string) {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.request<T>('post', path, body, token));
  }
  uploadWithProgress<T>(path: string, file: File, token: string | undefined, onProgress: (percent: number) => void) {
    const body = new FormData();
    body.append('file', file);
    return lastValueFrom(this.http.post<T>(`${API_URL}${path}`, body, { headers: this.headers(token), observe: 'events', reportProgress: true }).pipe(
      catchError((error) => this.shouldTryFallback(error) ? this.http.post<T>(`${FALLBACK_API_URL}${path}`, body, { headers: this.headers(token), observe: 'events', reportProgress: true }) : throwError(() => error)),
      catchError((error) => this.shouldRefresh(error, path, token) ? this.refreshSession().pipe(switchMap((session) => this.http.post<T>(`${API_URL}${path}`, body, { headers: this.headers(session.token), observe: 'events', reportProgress: true }).pipe(
        catchError((retryError) => this.shouldTryFallback(retryError) ? this.http.post<T>(`${FALLBACK_API_URL}${path}`, body, { headers: this.headers(session.token), observe: 'events', reportProgress: true }) : throwError(() => retryError)),
      ))) : throwError(() => normalizeApiError(error))),
      tap((event) => { if (event.type === HttpEventType.UploadProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100)); }),
      filter((event): event is HttpResponse<T> => event.type === HttpEventType.Response),
      map((event) => normalizeApiPayload(event.body as T)),
      catchError((error) => throwError(() => normalizeApiError(error))),
    ));
  }

  private request<T>(method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown, token?: string): Observable<T> {
    return this.rawRequest<T>(API_URL, method, path, body, token).pipe(
      catchError((error) => this.shouldTryFallback(error) ? this.rawRequest<T>(FALLBACK_API_URL, method, path, body, token) : throwError(() => error)),
      catchError((error) => this.shouldRefresh(error, path, token) ? this.refreshSession().pipe(switchMap((session) => this.rawRequest<T>(API_URL, method, path, body, session.token).pipe(
        catchError((retryError) => this.shouldTryFallback(retryError) ? this.rawRequest<T>(FALLBACK_API_URL, method, path, body, session.token) : throwError(() => retryError)),
      ))) : throwError(() => normalizeApiError(error))),
      catchError((error) => throwError(() => normalizeApiError(error))),
    );
  }

  private rawRequest<T>(baseUrl: string, method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown, token?: string) {
    const options = { headers: this.headers(token) };
    if (method === 'get') return this.http.get<T>(`${baseUrl}${path}`, options).pipe(map((payload) => normalizeApiPayload(payload)));
    if (method === 'post') return this.http.post<T>(`${baseUrl}${path}`, body, options).pipe(map((payload) => normalizeApiPayload(payload)));
    if (method === 'patch') return this.http.patch<T>(`${baseUrl}${path}`, body, options).pipe(map((payload) => normalizeApiPayload(payload)));
    return this.http.delete<T>(`${baseUrl}${path}`, options).pipe(map((payload) => normalizeApiPayload(payload)));
  }

  private shouldTryFallback(error: unknown) {
    return Boolean(FALLBACK_API_URL && isNetworkError(error));
  }

  private shouldRefresh(error: unknown, path: string, token?: string) {
    return Boolean(token && error instanceof HttpErrorResponse && error.status === 401 && !path.startsWith('/auth/'));
  }

  private refreshSession(): Observable<StoredSession & { token: string }> {
    const stored = this.readSession();
    if (!stored?.refreshToken) {
      this.dispatchSessionExpired();
      return throwError(() => new Error(LOGIN_AGAIN_MESSAGE));
    }
    return this.rawRequest<StoredSession & { token: string }>(API_URL, 'post', '/auth/refresh', { refreshToken: stored.refreshToken }).pipe(
      catchError((error) => this.shouldTryFallback(error) ? this.rawRequest<StoredSession & { token: string }>(FALLBACK_API_URL, 'post', '/auth/refresh', { refreshToken: stored.refreshToken }) : throwError(() => error)),
      tap((session) => {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        window.dispatchEvent(new CustomEvent('session-refreshed'));
      }),
      catchError((error) => {
        this.dispatchSessionExpired();
        return throwError(() => normalizeApiError(error));
      }),
    );
  }

  private readSession(): StoredSession | null {
    try {
      return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null') as StoredSession | null;
    } catch {
      return null;
    }
  }

  private dispatchSessionExpired() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('session-expired'));
  }
}
