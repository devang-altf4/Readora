import { useColorScheme } from 'react-native';
import { useThemeStore } from '../state/useThemeStore';

export function useAppColors() {
  const systemColorScheme = useColorScheme();
  const themeMode = useThemeStore((s) => s.themeMode);

  // App default opening is Dark Mode unless explicitly toggled
  const isDark = themeMode === 'light' ? false : true;

  return {
    isDark,
    // Light Mode: Warm E-Paper / Vellum Yellowish Tint (#F5F3EC) matching physical Kindle Paperwhite
    // Dark Mode: Pitch Black (#000000) e-ink
    bg: isDark ? '#000000' : '#F5F3EC',
    cardBg: isDark ? '#121212' : '#FFFFFF',
    searchBg: isDark ? '#1C1C1E' : '#EAE7DC',
    searchBorder: isDark ? '#2C2C2E' : '#D8D3C4',
    textPrimary: isDark ? '#E2E2E2' : '#171717',
    textSecondary: isDark ? '#A1A1A6' : '#5F635F',
    divider: isDark ? '#2C2C2E' : '#E3DFD5',
    chipBg: isDark ? '#1C1C1E' : '#EAE7DC',
    chipActiveBg: isDark ? '#2C2C2E' : '#171717',
    chipActiveBorder: isDark ? '#3B82F6' : '#171717',
    chipActiveText: '#FFFFFF',
    bottomBarBg: isDark ? '#000000' : '#F5F3EC',
    accent: '#3B82F6',
    welcomeBannerBg: isDark ? '#0E141D' : '#EAE7DC',
    welcomeBannerText: isDark ? '#FFFFFF' : '#171717',
    welcomeBannerSubtext: isDark ? '#94A3B8' : '#5F635F',
  };
}
