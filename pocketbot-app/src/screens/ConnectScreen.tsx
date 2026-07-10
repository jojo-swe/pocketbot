import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';
import { useConnection } from '../context/ConnectionContext';
import { testConnection } from '../services/api';
import QrScanScreen from './QrScanScreen';

export default function ConnectScreen() {
  const { conn, setConn } = useConnection();
  const [url, setUrl] = useState(conn.url || 'http://');
  const [secret, setSecret] = useState(conn.secret || '');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  const handleConnect = async () => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed || trimmed === 'http://' || trimmed === 'https://') {
      setError('Enter a valid server URL');
      return;
    }
    setError('');
    setTesting(true);
    const ok = await testConnection({ url: trimmed, secret: secret.trim() });
    setTesting(false);
    if (!ok) {
      setError('Could not reach server. Check URL and secret.');
      return;
    }
    await setConn({ url: trimmed, secret: secret.trim() });
  };

  const handlePaired = async (pairedUrl: string, pairedSecret: string) => {
    setScanning(false);
    setUrl(pairedUrl);
    setSecret(pairedSecret);
    setError('');
    setTesting(true);
    const ok = await testConnection({ url: pairedUrl, secret: pairedSecret });
    setTesting(false);
    if (!ok) {
      setError('Scanned server is unreachable. Check your network.');
      return;
    }
    await setConn({ url: pairedUrl, secret: pairedSecret });
  };

  if (scanning) {
    return (
      <QrScanScreen
        onPaired={handlePaired}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.emoji}>🤖</Text>
        <Text style={styles.title}>pocketbot</Text>
        <Text style={styles.subtitle}>
          Connect to your pocketbot server to get started.
        </Text>

        {/* QR scan shortcut */}
        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => setScanning(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="qr-code-outline" size={20} color={colors.pocket[400]} />
          <Text style={styles.qrButtonText}>Scan QR to pair</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.50:8080"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>
            Bootstrap Secret (optional)
          </Text>
          <TextInput
            style={styles.input}
            value={secret}
            onChangeText={setSecret}
            placeholder="Leave blank for local access"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, testing && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={testing}
            activeOpacity={0.7}
          >
            {testing ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Start your server with{' '}
          <Text style={styles.code}>pocketbot gateway</Text>
          {'\n'}then tap the 📱 icon in the web UI to pair.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emoji: { fontSize: 48, marginBottom: spacing.sm },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    maxWidth: 280,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.pocket[600],
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    marginTop: spacing.xxl,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.pocket[400],
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.pocket[600],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  qrButtonText: {
    color: colors.pocket[400],
    fontSize: 15,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
