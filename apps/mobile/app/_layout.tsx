import React from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeDatabase } from '../src/database/initializeDatabase';
import { useAppColors } from '../src/theme/useAppColors';
import { useAuthStore } from '../src/state/useAuthStore';
import { ActivityIndicator, View } from 'react-native';

const queryClient = new QueryClient();

export default function RootLayout() {
  const colors = useAppColors();
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated, hydrate } = useAuthStore();

  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  React.useEffect(() => {
    if (!hydrated) return;
    const onAuthRoute = pathname === '/auth';
    if (!user && !onAuthRoute) router.replace('/auth');
    if (user && onAuthRoute) router.replace('/');
  }, [hydrated, pathname, router, user]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <QueryClientProvider client={queryClient}>
        <SQLiteProvider databaseName="dindle.db" onInit={initializeDatabase}>
          <StatusBar style={colors.isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: colors.bg,
              },
              headerTintColor: colors.textPrimary,
              headerTitleStyle: {
                fontWeight: '600',
              },
              contentStyle: {
                backgroundColor: colors.bg,
              },
            }}
          >
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="book/[id]" options={{ title: 'Book Details' }} />
            <Stack.Screen name="reader/pdf/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="reader/smart/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
            <Stack.Screen name="about/index" options={{ title: 'About Dindle' }} />
          </Stack>
        </SQLiteProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
