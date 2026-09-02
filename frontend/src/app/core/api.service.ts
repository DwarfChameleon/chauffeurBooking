import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEventType, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, catchError, filter, firstValueFrom, lastValueFrom, map, tap, throwError } from 'rxjs';

const API_PORT = '5000';
const API_PATH = '/api';
const API_URL = resolveApiUrl();
const FALLBACK_API_URL = resolveFallbackApiUrl(API_URL);
const OFFLINE_MESSAGE = 'No internet connection. Please check your network and try again.';
const SERVER_UNREACHABLE_MESSAGE = 'Could not connect to the server. Please check your connection and try again.';

type RuntimeEnv = { __env?: { apiUrl?: string; fallbackApiUrl?: string } };

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
    return new Error(message || 'Request failed. Please try again.');
  }
  return error instanceof Error ? error : new Error('Request failed. Please try again.');
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
      catchError((error) => this.shouldTryFallback(error) ? this.http.post<T>(`${FALLBACK_API_URL}${path}`, body, { headers: this.headers(token), observe: 'events', reportProgress: true }) : throwError(() => normalizeApiError(error))),
      tap((event) => { if (event.type === HttpEventType.UploadProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100)); }),
      filter((event): event is HttpResponse<T> => event.type === HttpEventType.Response),
      map((event) => event.body as T),
      catchError((error) => throwError(() => normalizeApiError(error))),
    ));
  }

  private request<T>(method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown, token?: string): Observable<T> {
    return this.rawRequest<T>(API_URL, method, path, body, token).pipe(
      catchError((error) => this.shouldTryFallback(error) ? this.rawRequest<T>(FALLBACK_API_URL, method, path, body, token) : throwError(() => normalizeApiError(error))),
      catchError((error) => throwError(() => normalizeApiError(error))),
    );
  }

  private rawRequest<T>(baseUrl: string, method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown, token?: string) {
    const options = { headers: this.headers(token) };
    if (method === 'get') return this.http.get<T>(`${baseUrl}${path}`, options);
    if (method === 'post') return this.http.post<T>(`${baseUrl}${path}`, body, options);
    if (method === 'patch') return this.http.patch<T>(`${baseUrl}${path}`, body, options);
    return this.http.delete<T>(`${baseUrl}${path}`, options);
  }

  private shouldTryFallback(error: unknown) {
    return Boolean(FALLBACK_API_URL && isNetworkError(error));
  }
}
