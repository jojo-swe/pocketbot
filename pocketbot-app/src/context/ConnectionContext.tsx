/**
 * React context that holds the current server connection and exposes
 * helpers to update / clear it.  Every screen reads from here.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ServerConnection,
  loadConnection,
  saveConnection,
  clearConnection,
} from '../services/storage';

interface ConnectionContextValue {
  conn: ServerConnection;
  isConfigured: boolean;
  setConn: (c: ServerConnection) => Promise<void>;
  clear: () => Promise<void>;
  loading: boolean;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  conn: { url: '', secret: '' },
  isConfigured: false,
  setConn: async () => {},
  clear: async () => {},
  loading: true,
});

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [conn, _setConn] = useState<ServerConnection>({ url: '', secret: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnection().then((c) => {
      _setConn(c);
      setLoading(false);
    });
  }, []);

  const setConn = async (c: ServerConnection) => {
    _setConn(c);
    await saveConnection(c);
  };

  const clear = async () => {
    _setConn({ url: '', secret: '' });
    await clearConnection();
  };

  return (
    <ConnectionContext.Provider
      value={{
        conn,
        isConfigured: conn.url.length > 0,
        setConn,
        clear,
        loading,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext);
}
