import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.0bce6dfdcadc450496bf804b52ba13f7',
  appName: 'MHT CET MASTER',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-7641092018364594~2359083953',
    },
    EdgeToEdge: {
      backgroundColor: '#1a1a2e',
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
