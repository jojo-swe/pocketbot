import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';
import { useConnection } from '../context/ConnectionContext';
import {
  ChatMessage,
  ConnectionState,
  connect,
  disconnect,
  sendMessage,
} from '../services/chat';
import {
  PendingAttachment,
  uploadFile,
  mediaUrl,
} from '../services/upload';
import {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
} from '../services/storage';

export default function ChatScreen() {
  const { conn } = useConnection();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Load persisted history on first mount
  useEffect(() => {
    loadChatHistory().then((history) => {
      if (history.length > 0) {
        setMessages(history as ChatMessage[]);
      }
      setHistoryLoaded(true);
    });
  }, []);

  // Persist messages whenever they change (after history is loaded)
  useEffect(() => {
    if (!historyLoaded) return;
    saveChatHistory(messages);
  }, [messages, historyLoaded]);

  useEffect(() => {
    if (!conn.url) return;
    connect(conn, {
      onStateChange: setState,
      onMessage: (msg) => setMessages((prev) => [...prev, msg]),
      onTyping: setTyping,
      onError: (err) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ ${err}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      },
      onSessionId: () => {},
    });
    return () => disconnect();
  }, [conn.url, conn.token]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => { scrollToEnd(); }, [messages, typing]);

  // ── Attachment helpers ──────────────────────────────────────────────────────

  const startUpload = useCallback(
    async (localUri: string, name: string, mimeType: string) => {
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const entry: PendingAttachment = {
        localUri,
        name,
        mimeType,
        serverUrl: null,
        uploading: true,
        error: null,
      };
      setAttachments((prev) => [...prev, entry]);

      try {
        const result = await uploadFile(conn, localUri, name, mimeType);
        setAttachments((prev) =>
          prev.map((a) =>
            a === entry
              ? { ...a, serverUrl: result.url, uploading: false }
              : a,
          ),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setAttachments((prev) =>
          prev.map((a) =>
            a === entry ? { ...a, uploading: false, error: msg } : a,
          ),
        );
      }
      return id;
    },
    [conn],
  );

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
      const mime = asset.mimeType ?? 'image/jpeg';
      await startUpload(asset.uri, name, mime);
    }
  }, [startUpload]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain'],
      multiple: true,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      await startUpload(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
    }
  }, [startUpload]);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Send ────────────────────────────────────────────────────────────────────

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Clear History',
      'Delete all chat messages? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            clearChatHistory();
          },
        },
      ],
    );
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    const ready = attachments.filter((a) => a.serverUrl && !a.uploading);
    if (!text && ready.length === 0) return;

    let fullContent = text;
    if (ready.length > 0) {
      const links = ready.map((a) => {
        const url = mediaUrl(conn, a.serverUrl!);
        if (a.mimeType.startsWith('image/')) return `![image](${url})`;
        return `[${a.name}](${url})`;
      }).join('\n');
      fullContent = text ? `${text}\n${links}` : links;
    }

    const userMsg = sendMessage(fullContent);
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
  }, [input, attachments, conn]);

  // ── Rendering ───────────────────────────────────────────────────────────────

  const stateColor =
    state === 'connected' ? colors.success
    : state === 'connecting' ? colors.warning
    : colors.error;

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    // Detect image markdown in content: ![...](url)
    const imageMatches = [...item.content.matchAll(/!\[.*?\]\((https?:\/\/[^)]+)\)/g)];
    const textContent = item.content.replace(/!\[.*?\]\(https?:\/\/[^)]+\)/g, '').trim();

    return (
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {!isUser && <Text style={styles.avatar}>🤖</Text>}
        <View style={[
          styles.bubbleContent,
          isUser ? styles.bubbleContentUser : styles.bubbleContentAssistant,
        ]}>
          {imageMatches.map((m, i) => (
            <Image
              key={i}
              source={{ uri: m[1] }}
              style={styles.msgImage}
              contentFit="cover"
            />
          ))}
          {textContent.length > 0 && (
            <Text
              style={[styles.messageText, isUser && { color: colors.white }]}
              selectable
            >
              {textContent}
            </Text>
          )}
        </View>
      </View>
    );
  }, []);

  const canSend =
    state === 'connected' &&
    (input.trim().length > 0 || attachments.some((a) => a.serverUrl));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Connection status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: stateColor }]} />
        <Text style={styles.statusText}>{state}</Text>
        {messages.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearHistory}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🤖</Text>
          <Text style={styles.emptyTitle}>Welcome to pocketbot</Text>
          <Text style={styles.emptySubtitle}>Type a message or attach a file to start.</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollToEnd}
        />
      )}

      {/* Typing indicator */}
      {typing && (
        <View style={styles.typingRow}>
          <Text style={styles.typingText}>pocketbot is thinking…</Text>
        </View>
      )}

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          style={styles.attachStrip}
          contentContainerStyle={styles.attachStripContent}
          showsHorizontalScrollIndicator={false}
        >
          {attachments.map((a, idx) => (
            <View key={idx} style={styles.attachThumb}>
              {a.mimeType.startsWith('image/') ? (
                <Image source={{ uri: a.localUri }} style={styles.thumbImage} contentFit="cover" />
              ) : (
                <View style={styles.thumbFile}>
                  <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.thumbFileName} numberOfLines={1}>{a.name}</Text>
                </View>
              )}
              {a.uploading && (
                <View style={styles.thumbOverlay}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              )}
              {a.error && (
                <View style={[styles.thumbOverlay, { backgroundColor: 'rgba(239,68,68,0.7)' }]}>
                  <Ionicons name="alert-circle" size={16} color={colors.white} />
                </View>
              )}
              <TouchableOpacity style={styles.thumbRemove} onPress={() => removeAttachment(idx)}>
                <Ionicons name="close-circle" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn} onPress={pickImage} activeOpacity={0.7}>
          <Ionicons name="image-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachBtn} onPress={pickDocument} activeOpacity={0.7}>
          <Ionicons name="attach-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  statusText: { fontSize: 12, color: colors.textMuted, flex: 1 },
  clearBtn: { padding: spacing.xs },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  bubble: { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-start' },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleAssistant: { justifyContent: 'flex-start' },
  avatar: { fontSize: 20, marginRight: spacing.sm, marginTop: 2 },
  bubbleContent: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleContentUser: {
    backgroundColor: colors.pocket[600],
    borderBottomRightRadius: radius.sm,
  },
  bubbleContentAssistant: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: radius.sm,
  },
  messageText: { fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  msgImage: {
    width: 220,
    height: 160,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  typingRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  typingText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  attachStrip: {
    maxHeight: 88,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  attachStripContent: { padding: spacing.sm, gap: spacing.sm },
  attachThumb: { position: 'relative', width: 72, height: 72 },
  thumbImage: { width: 72, height: 72, borderRadius: radius.md },
  thumbFile: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xs,
  },
  thumbFileName: { fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbRemove: { position: 'absolute', top: -6, right: -6 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  attachBtn: {
    paddingHorizontal: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  sendButton: {
    backgroundColor: colors.pocket[500],
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
