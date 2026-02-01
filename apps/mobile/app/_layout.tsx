import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { colorScheme } from 'nativewind';
import { PortalHost } from '@rn-primitives/portal';
import '../global.css';

import { useAppFonts } from '@/shared';
import { useColorScheme } from '@/shared/lib/useColorScheme';
import { NAV_THEME } from '@/shared/lib/constants';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const RootLayout = () => {
  const [loaded, error] = useAppFonts();
  const currentColorScheme = useColorScheme();

  // NativeWind의 colorScheme 설정 (앱 시작시 적용)
  useEffect(() => {
    colorScheme.set(currentColorScheme);
  }, [currentColorScheme]);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
};

const RootLayoutNav = () => {
  const currentColorScheme = useColorScheme();
  const isDark = currentColorScheme === 'dark';

  return (
    <ThemeProvider value={NAV_THEME[currentColorScheme]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <PortalHost />
    </ThemeProvider>
  );
};

// Expo Router requires default export for route components
export default RootLayout;

