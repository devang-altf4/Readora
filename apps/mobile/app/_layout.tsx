import React from 'react';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeDatabase } from '../src/database/initializeDatabase';
import { useAppColors } from '../src/theme/useAppColors';

const queryClient = new QueryClient();

export default function RootLayout() {
  const colors = useAppColors();

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
