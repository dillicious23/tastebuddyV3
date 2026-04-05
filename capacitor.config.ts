import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'tastebuddyV2',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      backgroundColor: '#131A24', // Tastebuddy background color!
      showSpinner: false,
    }
  }
};

export default config;
