import { registerPlugin } from '@capacitor/core';

export interface SmsBridgePlugin {
  requestPermission(): Promise<{ granted: boolean }>;
  configure(options: { apiUrl: string; token: string }): Promise<{ configured: boolean }>;
  status(): Promise<{ permissionGranted: boolean; configured: boolean }>;
}

export const SmsBridge = registerPlugin<SmsBridgePlugin>('SmsBridge');
