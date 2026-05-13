import React, { useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import RootNavigator from './src/navigation/RootNavigator';
import { ConsentModal } from './src/components/ConsentModal';
import { useThemeStore } from './src/store/themeStore';
import { suppressProductionLogs } from './src/utils/logger';
import { useFonts } from 'expo-font';
import { getColors } from './src/constants/colors';
import { NotificationService } from './src/services/NotificationService';
import { InAppNotificationBanner } from './src/components/InAppNotificationBanner';

// Sentry initialization is disabled during local development to prevent Expo Go native module crashes.
// It will be enabled in the final EAS build.


// Keep the splash screen visible while we fetch resources if needed
SplashScreen.preventAutoHideAsync().catch(() => {});

function App() {
  const [fontsLoaded] = useFonts({
    'Rocaston': require('./assets/fonts/Rocaston.ttf'),
  });

  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const colors = getColors(theme);

  useEffect(() => {
    suppressProductionLogs();
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
      NotificationService.initialize();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar 
          barStyle={isDark ? "light-content" : "dark-content"} 
          backgroundColor={colors.background}
          translucent 
        />
        <InAppNotificationBanner />
        <RootNavigator />
        <ConsentModal />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
