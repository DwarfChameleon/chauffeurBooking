import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark = false;
  driverIsDark = true;

  constructor() {
    try {
      this.isDark = localStorage.getItem('verified-dispatch-theme') === 'dark';
      const savedDriverTheme = localStorage.getItem('verified-dispatch-driver-theme');
      this.driverIsDark = savedDriverTheme !== 'light';
    } catch { this.isDark = false; this.driverIsDark = true; }
    this.apply();
  }

  toggle() {
    this.isDark = !this.isDark;
    try { localStorage.setItem('verified-dispatch-theme', this.isDark ? 'dark' : 'light'); } catch { /* storage can be unavailable in private webviews */ }
    this.apply();
  }

  toggleDriver() {
    this.driverIsDark = !this.driverIsDark;
    try { localStorage.setItem('verified-dispatch-driver-theme', this.driverIsDark ? 'dark' : 'light'); } catch { /* storage can be unavailable in private webviews */ }
    this.apply();
  }

  private apply() {
    document.body.classList.toggle('dark-theme', this.isDark);
    document.body.classList.toggle('driver-light-theme', !this.driverIsDark);
    document.body.classList.toggle('driver-dark-theme', this.driverIsDark);
    document.documentElement.style.colorScheme = this.isDark ? 'dark' : 'light';
  }
}
