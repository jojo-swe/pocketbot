import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useConnection } from '../context/ConnectionContext';
import {
  bootstrap,
  getSettings,
  updateSettings,
  type BootstrapResult,
  type SettingsResponse,
} from '../services/api';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'int' | 'float';
}

const EDITABLE_FIELDS: FieldDef[] = [
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'max_tokens', label: 'Max Tokens', type: 'int' },
  { key: 'temperature', label: 'Temperature', type: 'float' },
  { key: 'memory_window', label: 'Memory Window', type: 'int' },
];

export default function SettingsScreen() {
  const { conn, clear } = useConnection();
  const [bs, setBs] = useState<BootstrapResult | null>(null);
  const [config, setConfig] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bootstrapResult = await bootstrap(conn);
      setBs(bootstrapResult);
      const c = await getSettings(conn, bootstrapResult);
      setConfig(c);
      setDraft({
        model: String(c.model ?? ''),
        max_tokens: String(c.max_tokens ?? ''),
        temperature: String(c.temperature ?? ''),
        memory_window: String(c.memory_window ?? ''),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, [conn]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const hasChanges = config
    ? draft.model !== String(config.model ?? '') ||
      draft.max_tokens !== String(config.max_tokens ?? '') ||
      draft.temperature !== String(config.temperature ?? '') ||
      draft.memory_window !== String(config.memory_window ?? '')
    : false;

  const handleSave = useCallback(async () => {
    if (!config || !bs) return;
    setSaving(true);
    setError('');
    try {
      const update: Record<string, unknown> = {};
      if (draft.model !== String(config.model ?? '')) update.model = draft.model;
      if (draft.max_tokens !== String(config.max_tokens ?? ''))
        update.max_tokens = Number.parseInt(draft.max_tokens, 10);
      if (draft.temperature !== String(config.temperature ?? ''))
        update.temperature = Number.parseFloat(draft.temperature);
      if (draft.memory_window !== String(config.memory_window ?? ''))
        update.memory_window = Number.parseInt(draft.memory_window, 10);

      const res = await updateSettings(conn, bs, update);
      if (Object.keys(res.errors).length > 0) {
        setError(Object.values(res.errors).join(', '));
      }
      await loadConfig();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [config, draft, conn, bs, loadConfig]);

  const handleReset = useCallback(() => {
    if (!config) return;
    setDraft({
      model: String(config.model ?? ''),
      max_tokens: String(config.max_tokens ?? ''),
      temperature: String(config.temperature ?? ''),
      memory_window: String(config.memory_window ?? ''),
    });
  }, [config]);

  const [rotating, setRotating] = useState(false);
  const [rotatedToken, setRotatedToken] = useState('');

  const handleRotateToken = useCallback(async () => {
    Alert.alert(
      'Rotate Bootstrap Secret',
      'This will generate a new bootstrap secret and invalidate the current one. You will need to update all connected clients.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          style: 'destructive',
          onPress: async () => {
            setRotating(true);
            setRotatedToken('');
            setError('');
            try {
              const base = conn.url.replace(/\/+$/, '');
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
              };
              if (conn.secret) headers['Authorization'] = `Bearer ${conn.secret}`;
              const res = await fetch(`${base}/api/settings/rotate-secret`, {
                method: 'POST',
                headers,
              });
              if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error((d as Record<string, string>).detail || `HTTP ${res.status}`);
              }
              const data = await res.json() as { secret: string };
              setRotatedToken(data.secret);
              Alert.alert(
                'Secret Rotated',
                `New secret:\n\n${data.secret}\n\nUpdate your app connection settings with this secret.`,
                [{ text: 'OK' }],
              );
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : 'Rotation failed');
            } finally {
              setRotating(false);
            }
          },
        },
      ],
    );
  }, [conn]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect',
      'Remove saved server connection?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => clear() },
      ],
    );
  }, [clear]);

  if (loading && !config) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.pocket[400]} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Editable Settings</Text>

      {EDITABLE_FIELDS.map((field) => (
        <View key={field.key} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <TextInput
            style={[
              styles.fieldInput,
              draft[field.key] !== (config ? String(config[field.key] ?? '') : '')
                ? styles.fieldChanged
                : undefined,
            ]}
            value={draft[field.key] ?? ''}
            onChangeText={(v) => setDraft((prev) => ({ ...prev, [field.key]: v }))}
            keyboardType={field.type === 'text' ? 'default' : 'numeric'}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {hasChanges && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>
        Read-Only Info
      </Text>

      {config && (
        <View style={styles.infoGrid}>
          <InfoCard label="Workspace" value={String(config.workspace ?? '—')} />
          <InfoCard label="Max Iterations" value={String(config.max_tool_iterations ?? '—')} />
          <InfoCard label="Provider" value={String(config.provider ?? '—')} />
          <InfoCard
            label="Auth"
            value={config.auth_enabled ? 'enabled' : 'disabled'}
            valueColor={config.auth_enabled ? colors.success : colors.warning}
          />
        </View>
      )}

      {/* Security section */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Security</Text>
      <TouchableOpacity
        style={styles.rotateBtn}
        onPress={handleRotateToken}
        disabled={rotating}
        activeOpacity={0.7}
      >
        {rotating ? (
          <ActivityIndicator color={colors.warning} size="small" />
        ) : (
          <Text style={styles.rotateBtnText}>🔑 Rotate Bootstrap Secret</Text>
        )}
      </TouchableOpacity>
      {rotatedToken ? (
        <Text style={styles.rotatedToken} selectable>
          New secret: {rotatedToken}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.disconnectBtn}
        onPress={handleDisconnect}
        activeOpacity={0.7}
      >
        <Text style={styles.disconnectText}>Disconnect Server</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 60 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  fieldRow: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  fieldInput: {
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
  fieldChanged: {
    borderColor: colors.warning,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.pocket[600],
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  resetBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  resetBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  rotateBtn: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    marginBottom: spacing.sm,
  },
  rotateBtnText: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '600',
  },
  rotatedToken: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  disconnectBtn: {
    marginTop: spacing.xxl,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
  },
  disconnectText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
});
