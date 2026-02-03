import '@/global.css';
import '@/lib/i18n'; // Initialize i18n

import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { SQLiteProvider } from 'expo-sqlite';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Device from 'expo-device';
import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Icon } from '@/components/nativewindui/Icon';
import { ThemeToggle } from '@/components/nativewindui/ThemeToggle';
import { cn } from '@/lib/cn';
import { useColorScheme } from '@/lib/useColorScheme';
import { NAV_THEME } from '@/theme';
import { migrateDbIfNeeded } from '@/utils/database';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const isIos26 = Platform.select({ default: false, ios: Device.osVersion?.startsWith('26.') });

import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Image, Text, Animated, Easing } from 'react-native';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { useFonts } from 'expo-font';

import * as Notifications from 'expo-notifications';

// ... existing imports

export default function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    'SFPro': require('../assets/fonts/sf-pro-text-regular.otf'),
  });

  // Animation values
  const [rotateValue] = useState(new Animated.Value(0));
  const [bounceValue] = useState(new Animated.Value(0));

  useEffect(() => {
    // Start animations
    const startAnimations = () => {
      // ... existing animation logic
      Animated.loop(
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceValue, {
            toValue: -20, // Move up
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bounceValue, {
            toValue: 0, // Move down
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          })
        ])
      ).start();
    };

    startAnimations();

    async function prepare() {
      try {
        // Artificially delay for 3 seconds to show off the animation
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (e) {
        console.warn(e);
      } finally {
        if (fontsLoaded || fontError) {
          setAppIsReady(true);
        }
      }
    }

    if (fontsLoaded || fontError) {
      prepare();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Notification listeners
    const subscription1 = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const subscription2 = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
    });

    return () => {
      subscription1.remove();
      subscription2.remove();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // safe to do nothing or handle other layout logic
    }
  }, [appIsReady]);

  // Interpolate rotation
  const spin = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  if (!appIsReady) {
    return (
      <View 
        className="flex-1 items-center justify-center bg-white"
        onLayout={async () => {
          await SplashScreen.hideAsync();
        }}
      >
        <Animated.Image 
          source={require('../assets/icon.png')} 
          style={{ 
            width: 150, 
            height: 150, 
            marginBottom: 20,
            transform: [
              { rotate: spin },
              { translateY: bounceValue }
            ]
          }}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#000000" className="mb-4" />
        <Text className="text-black text-lg font-bold">Tunggu ya...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar
        key={`root-status-bar-${isDarkColorScheme ? 'light' : 'dark'}`}
        style={isDarkColorScheme ? 'light' : 'dark'}
      />
      {/* WRAP YOUR APP WITH ANY ADDITIONAL PROVIDERS HERE */}
      <SQLiteProvider databaseName="myuang_clean.db" onInit={migrateDbIfNeeded}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <ActionSheetProvider>
          <NavThemeProvider value={NAV_THEME[colorScheme]}>
            <Stack
              screenOptions={{
                headerTitleStyle: {
                  fontFamily: 'SFPro',
                  fontWeight: '500', // Medium weight
                },
                headerBackTitleStyle: {
                  fontFamily: 'SFPro',
                },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="add-transaction" options={{ headerShown: false }} />
            </Stack>
          </NavThemeProvider>
        </ActionSheetProvider>
        </GestureHandlerRootView>
      </SQLiteProvider>
    </View>
  );
}

const INDEX_OPTIONS = {
  headerLargeTitle: true,
  headerTransparent: isIos26,
  title: 'NativewindUI',
  headerRight: () => <SettingsIcon />,
} as const;

function SettingsIcon() {
  return (
    <Link href="/settings" asChild>
      <Pressable className={cn('opacity-80 active:opacity-50', isIos26 && 'px-1.5')}>
        <Icon name="gearshape" className="text-foreground" />
      </Pressable>
    </Link>
  );
}


