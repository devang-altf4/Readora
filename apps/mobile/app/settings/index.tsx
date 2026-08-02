import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_API_BASE_URL } from '../../src/constants/config';
import { useThemeStore, AppThemeMode } from '../../src/state/useThemeStore';
import { useAppColors } from '../../src/theme/useAppColors';

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { themeMode, setThemeMode } = useThemeStore();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_BASE_URL);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* App Theme Mode Switcher */}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>App Theme Mode</Text>
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Select App Appearance</Text>
        <View style={styles.themeRow}>
          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              {
                backgroundColor: themeMode === 'dark' ? '#2563EB' : colors.chipBg,
                borderColor: themeMode === 'dark' ? '#3B82F6' : colors.divider,
              }
            ]}
            onPress={() => setThemeMode('dark')}
          >
            <Text style={{ color: themeMode === 'dark' ? '#FFFFFF' : colors.textPrimary, fontWeight: 'bold', fontSize: 13 }}>
              Dark Mode
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              {
                backgroundColor: themeMode === 'light' ? '#171717' : colors.chipBg,
                borderColor: themeMode === 'light' ? '#171717' : colors.divider,
              }
            ]}
            onPress={() => setThemeMode('light')}
          >
            <Text style={{ color: themeMode === 'light' ? '#FFFFFF' : colors.textPrimary, fontWeight: 'bold', fontSize: 13 }}>
              Vellum Light
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              {
                backgroundColor: themeMode === 'system' ? '#2563EB' : colors.chipBg,
                borderColor: themeMode === 'system' ? '#3B82F6' : colors.divider,
              }
            ]}
            onPress={() => setThemeMode('system')}
          >
            <Text style={{ color: themeMode === 'system' ? '#FFFFFF' : colors.textPrimary, fontWeight: 'bold', fontSize: 13 }}>
              System Auto
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Backend Configuration</Text>
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>FastAPI Backend Base URL</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bg, color: colors.textPrimary }]}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="http://192.168.29.159:8000/api/v1"
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Auto-detected machine LAN IP: {DEFAULT_API_BASE_URL}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Reading Preferences</Text>
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Default Font: Literata (Serif)</Text>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Offline Storage: Expo SQLite Enabled</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
      <TouchableOpacity
        style={[styles.aboutBtn, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}
        onPress={() => router.push('/about')}
      >
        <Text style={[styles.aboutBtnText, { color: colors.textPrimary }]}>About Dindle & License →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Playfair Display',
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  input: {
    height: 44,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  hint: {
    fontSize: 11,
  },
  rowLabel: {
    fontSize: 14,
  },
  aboutBtn: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  aboutBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
