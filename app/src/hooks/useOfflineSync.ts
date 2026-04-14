import { useState, useEffect, useCallback } from 'react';
import { openDB, IDBPDatabase } from 'idb';

interface SyncQueueItem {
  id: string;
  type: 'translation' | 'session' | 'export';
  data: unknown;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
}

const DB_NAME = 'daraja-offline';
const DB_VERSION = 1;
const SYNC_QUEUE_STORE = 'sync-queue';
const SESSIONS_STORE = 'sessions';
const TRANSLATIONS_STORE = 'translations';

async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Sync queue for pending operations
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
        syncStore.createIndex('createdAt', 'createdAt');
      }

      // Sessions store
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        sessionsStore.createIndex('workflowType', 'workflowType');
        sessionsStore.createIndex('status', 'status');
      }

      // Translations cache
      if (!db.objectStoreNames.contains(TRANSLATIONS_STORE)) {
        const translationsStore = db.createObjectStore(TRANSLATIONS_STORE, { keyPath: 'id' });
        translationsStore.createIndex('sessionId', 'sessionId');
      }
    },
  });
}

export function useOfflineSync() {
  const [state, setState] = useState<OfflineSyncState>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
    lastSyncAt: null,
  });

  const [db, setDb] = useState<IDBPDatabase | null>(null);

  // Initialize database
  useEffect(() => {
    initDB().then(setDb).catch(console.error);
  }, []);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setState((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setState((s) => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Count pending items
  useEffect(() => {
    if (!db) return;

    const countPending = async () => {
      const count = await db.count(SYNC_QUEUE_STORE);
      setState((s) => ({ ...s, pendingCount: count }));
    };

    countPending();
    const interval = setInterval(countPending, 5000);
    return () => clearInterval(interval);
  }, [db]);

  // Add item to sync queue
  const addToQueue = useCallback(
    async (type: SyncQueueItem['type'], data: unknown) => {
      if (!db) return;

      const item: SyncQueueItem = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        data,
        createdAt: Date.now(),
        retryCount: 0,
      };

      await db.add(SYNC_QUEUE_STORE, item);
      setState((s) => ({ ...s, pendingCount: s.pendingCount + 1 }));
    },
    [db]
  );

  // Process sync queue
  const processQueue = useCallback(async () => {
    if (!db || !state.isOnline || state.isSyncing) return;

    setState((s) => ({ ...s, isSyncing: true }));

    try {
      const items = await db.getAll(SYNC_QUEUE_STORE);

      for (const item of items) {
        try {
          // Process based on type
          switch (item.type) {
            case 'translation':
              // In a real app, this would send to a server
              console.log('Syncing translation:', item.id);
              break;
            case 'session':
              console.log('Syncing session:', item.id);
              break;
            case 'export':
              console.log('Syncing export:', item.id);
              break;
          }

          // Remove from queue on success
          await db.delete(SYNC_QUEUE_STORE, item.id);
        } catch (error) {
          // Update retry count on failure
          const updatedItem = {
            ...item,
            retryCount: item.retryCount + 1,
            lastError: String(error),
          };
          await db.put(SYNC_QUEUE_STORE, updatedItem);
        }
      }

      const newPendingCount = await db.count(SYNC_QUEUE_STORE);
      setState((s) => ({
        ...s,
        isSyncing: false,
        lastSyncAt: Date.now(),
        pendingCount: newPendingCount,
      }));
    } catch (error) {
      console.error('Sync failed:', error);
      setState((s) => ({ ...s, isSyncing: false }));
    }
  }, [db, state.isOnline, state.isSyncing]);

  // Auto-sync when online
  useEffect(() => {
    if (state.isOnline && state.pendingCount > 0 && !state.isSyncing) {
      processQueue();
    }
  }, [state.isOnline, state.pendingCount, state.isSyncing, processQueue]);

  // Save session to IndexedDB
  const saveSession = useCallback(
    async (session: unknown) => {
      if (!db) return;
      await db.put(SESSIONS_STORE, session);
    },
    [db]
  );

  // Load session from IndexedDB
  const loadSession = useCallback(
    async (sessionId: string) => {
      if (!db) return null;
      return db.get(SESSIONS_STORE, sessionId);
    },
    [db]
  );

  // Get all sessions
  const getAllSessions = useCallback(async () => {
    if (!db) return [];
    return db.getAll(SESSIONS_STORE);
  }, [db]);

  // Save translation to cache
  const cacheTranslation = useCallback(
    async (translation: { id: string; sessionId: string; [key: string]: unknown }) => {
      if (!db) return;
      await db.put(TRANSLATIONS_STORE, translation);
    },
    [db]
  );

  // Get cached translations for session
  const getCachedTranslations = useCallback(
    async (sessionId: string) => {
      if (!db) return [];
      const index = db.transaction(TRANSLATIONS_STORE).store.index('sessionId');
      return index.getAll(sessionId);
    },
    [db]
  );

  return {
    ...state,
    addToQueue,
    processQueue,
    saveSession,
    loadSession,
    getAllSessions,
    cacheTranslation,
    getCachedTranslations,
  };
}
