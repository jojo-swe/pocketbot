import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useConnection } from '../context/ConnectionContext';
import { bootstrap, type BootstrapResult } from '../services/api';

interface StatCardProps {
  label: string;
  value: string;
  valueColor?: string;
}

function StatCard({ label, value, valueColor }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

export default function StatusScreen() {
  const { conn } = useConnection();
  const [bs, setBs] = useState<BootstrapResult | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await bootstrap(conn);
      setBs(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, [conn]);

  const doPing = useCallback(async () => {
    try {
      const start = Date.now();
      await bootstrap(conn);
      setPingMs(Date.now() - start);
    } catch {
      setPingMs(-1);
    }
  }, [conn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={colors.pocket[400]}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Status & Diagnostics</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerBtn} onPress={refresh}>
            <Text style={styles.headerBtnText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={doPing}>
            <Text style={styles.headerBtnText}>Ping</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !bs ? (
        <ActivityIndicator
          color={colors.pocket[400]}
          size="large"
          style={{ marginTop: 40 }}
        />
      ) : bs ? (
        <View style={styles.grid}>
          <StatCard
            label="Status"
            value="online"
            valueColor={colors.success}
          />
          <StatCard label="Model" value={bs.model_name} valueColor={colors.pocket[400]} />
          <StatCard label="Runtime" value={bs.runtime_surface} />
          <StatCard label="Token TTL" value={`${bs.expires_in}s`} />
          <StatCard
            label="Ping"
            value={
              pingMs === null
                ? '—'
                : pingMs < 0
                  ? 'failed'
                  : `${pingMs}ms`
            }
            valueColor={
              pingMs === null
                ? undefined
                : pingMs < 0
                  ? colors.error
                  : pingMs < 100
                    ? colors.success
                    : colors.warning
            }
          />
        </View>
      ) : null}

      <View style={styles.serverInfo}>
        <Text style={styles.serverLabel}>Connected to</Text>
        <Text style={styles.serverUrl}>{conn.url}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  headerButtons: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  headerBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: 13 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  serverInfo: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  serverLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  serverUrl: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
});
