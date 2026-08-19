import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.calendarapp.secure',
  appName: 'Calendar',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
