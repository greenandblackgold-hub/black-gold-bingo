import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blackgoldplc.bingopro',
  appName: 'Black Gold Bingo PRO',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
