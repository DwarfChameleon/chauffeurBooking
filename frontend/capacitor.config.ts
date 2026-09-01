import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.verifieddispatch.app',
  appName: 'Verified Dispatch',
  webDir: 'dist/verified-dispatch/browser',
  bundledWebRuntime: false,
  plugins: { Geolocation: { permissions: ['location'] } }
};

export default config;
