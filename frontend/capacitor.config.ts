import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bjed.chauffer',
  appName: 'B-JED Chauffer',
  webDir: 'dist/verified-dispatch/browser',
  plugins: {
    Geolocation: { permissions: ['location'] },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      launchFadeOutDuration: 220,
      backgroundColor: '#f8f5ef',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};


export default config;
