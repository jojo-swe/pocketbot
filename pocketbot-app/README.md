# pocketbot-app

React Native Expo mobile client for the pocketbot gateway.

## Features

- **Bootstrap secret authentication** — connects to the gateway using a bootstrap secret instead of bearer tokens
- **Multiplexed WebSocket chat** — streaming assistant responses via `delta`/`stream_end`/`turn_end` events
- **Media attachments** — images and documents sent as base64 data URLs inline with WS message frames
- **QR code pairing** — scan a QR code from the gateway WebUI to auto-configure connection
- **Settings management** — view and edit gateway settings (model, max tokens, temperature, memory window)
- **Status & diagnostics** — online status, model name, runtime surface, token TTL, ping
- **Push notifications** — Expo push token registration with the gateway

## Architecture

```text
src/
  services/
    api.ts        — gateway REST client (bootstrap, settings, sessions, testConnection)
    chat.ts       — multiplexed WS client (connect, sendMessage, streaming callbacks)
    storage.ts    — AsyncStorage persistence (ServerConnection, chat history)
    upload.ts     — file-to-base64 data URL helper for inline media
    push.ts       — Expo push notification registration/unregistration
  context/
    ConnectionContext.tsx — React context for server connection state
  screens/
    ChatScreen.tsx     — chat UI with streaming, attachments, history
    ConnectScreen.tsx  — manual connection + QR pairing entry point
    SettingsScreen.tsx — gateway settings editor + secret rotation
    StatusScreen.tsx   — bootstrap-based status diagnostics
    QrScanScreen.tsx   — QR scanner for gateway pairing
  navigation/
    AppNavigator.tsx — bottom tab navigator
  theme.ts           — shared colors, spacing, radius
```

## Getting Started

```bash
npm install
npx expo start
```

## Connection Model

The app uses the gateway's bootstrap flow:

1. User enters gateway URL + bootstrap secret (or scans QR code)
2. App calls `POST /api/bootstrap` with the secret to obtain a short-lived token
3. Token is used to open a multiplexed WebSocket (`ws://host/?token=...`)
4. Gateway sends `ready` event with `chat_id` and `client_id`
5. Messages flow as `message` frames; responses stream via `delta` → `stream_end` → `turn_end`

## Testing

```bash
npm test
```

Tests use `ts-jest` with a mock for `@react-native-async-storage/async-storage`.
