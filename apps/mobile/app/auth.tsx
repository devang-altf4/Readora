import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppColors } from '../src/theme/useAppColors';
import { describeApiError } from '../src/services/apiClient';
import { useAuthStore } from '../src/state/useAuthStore';

export default function AuthScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    try {
      setBusy(true);
      setError(null);
      if (mode === 'signup') await register(cleanUsername, password);
      else await login(cleanUsername, password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.divider }]}>
          <Text style={[styles.brand, { color: colors.textPrimary }]}>Readora</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {mode === 'signin' ? 'Welcome back to your library.' : 'Create your private reading account.'}
          </Text>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signin' && { backgroundColor: colors.accent }]}
              onPress={() => { setMode('signin'); setError(null); }}
            >
              <Text style={[styles.modeText, { color: mode === 'signin' ? '#FFFFFF' : colors.textSecondary }]}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signup' && { backgroundColor: colors.accent }]}
              onPress={() => { setMode('signup'); setError(null); }}
            >
              <Text style={[styles.modeText, { color: mode === 'signup' ? '#FFFFFF' : colors.textSecondary }]}>Create account</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.textPrimary }]}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            placeholder="Password (8+ characters)"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.textPrimary }]}
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.accent }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
          </TouchableOpacity>
          <Text style={[styles.privacyText, { color: colors.textSecondary }]}>You’ll stay signed in on this device for 30 days.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 22 },
  card: { borderRadius: 18, borderWidth: 1, padding: 22 },
  brand: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 22 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  modeButton: { flex: 1, borderRadius: 9, paddingVertical: 11, alignItems: 'center' },
  modeText: { fontWeight: '700', fontSize: 13 },
  input: { borderRadius: 10, borderWidth: 1, height: 50, paddingHorizontal: 14, marginBottom: 12, fontSize: 16 },
  error: { color: '#D64545', fontSize: 13, marginBottom: 12 },
  submitButton: { borderRadius: 10, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  privacyText: { fontSize: 11, textAlign: 'center', marginTop: 16 },
});
