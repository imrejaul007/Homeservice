import type { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.nilin.app',
  appName: 'NILIN',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://homeservice-1.onrender.com',
  },
  android: {
    backgroundColor: '#F5E6E0',
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#6366F1',
      showSpinner: false,
      spinnerColor: '#E8B4A8',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#6366F1',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      scrollPadding: true,
    },
    DeepLinks: {
      customSchemes: ['nilin'],
      hosts: {
        nilin: 'open',
        'nilin.app': 'app',
      },
    },
    Camera: {
      promptLabelPhoto: 'Choose from Gallery',
      promptLabelPicture: 'Take a Photo',
      promptLabelCancel: 'Cancel',
    },
    Geolocation: {
      enableHighAccuracy: true,
    },
    Preferences: {
      // Preferences plugin configuration (uses platform defaults)
    },
    Filesystem: {
      iosAllowMessagePreview: true,
    },
    App: {
      allowMixedContent: true,
    },
    NativeBiometric: {
      title: 'NILIN Sign In',
      subtitle: 'Authenticate to access your account',
      description: 'Use your fingerprint or face to quickly sign in',
      cancelButtonText: 'Use Password',
      maxAttempts: 3,
      useFallback: false,
    },
  },
};

export default config;
