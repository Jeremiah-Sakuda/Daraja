/**
 * Sync Service
 *
 * Handles offline data persistence and synchronization.
 * Uses IndexedDB for local storage with a sync queue for
 * operations to be performed when connectivity returns.
 */

import type { WorkflowSession } from './workflow';
import type { TranslationResponse } from './translation';

// Database configuration
const DB_NAME = 'daraja-offline';
const DB_VERSION = 1;

const STORES = {
  sessions: 'sessions',
  translations: 'translations',
  syncQueue: 'syncQueue',
  settings: 'settings',
} as const;

// Sync queue item types
export interface SyncQueueItem {
  id: string;
  type: 'session' | 'translation' | 'feedback';
  operation: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: string;
  attempts: number;
  lastAttempt?: string;
  error?: string;
}

// Cached translation for offline use
export interface CachedTranslation {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  domain: string;
  confidence: number;
  timestamp: string;
  accessCount: number;
}

// Sync status
export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime?: string;
  pendingCount: number;
  failedCount: number;
}

/**
 * IndexedDB wrapper for offline storage
 */
class OfflineStore {
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('Database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Sessions store
        if (!db.objectStoreNames.contains(STORES.sessions)) {
          const sessionsStore = db.createObjectStore(STORES.sessions, {
            keyPath: 'id',
          });
          sessionsStore.createIndex('workflowId', 'workflowId', { unique: false });
          sessionsStore.createIndex('status', 'status', { unique: false });
          sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Translations cache store
        if (!db.objectStoreNames.contains(STORES.translations)) {
          const translationsStore = db.createObjectStore(STORES.translations, {
            keyPath: 'id',
          });
          translationsStore.createIndex('sourceText', 'sourceText', { unique: false });
          translationsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains(STORES.syncQueue)) {
          const syncStore = db.createObjectStore(STORES.syncQueue, {
            keyPath: 'id',
          });
          syncStore.createIndex('type', 'type', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Get database instance
   */
  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Generic get operation
   */
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic getAll operation
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic put operation
   */
  async put<T>(storeName: string, value: T): Promise<void> {
    const db = this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic delete operation
   */
  async delete(storeName: string, key: string): Promise<void> {
    const db = this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all data from a store
   */
  async clear(storeName: string): Promise<void> {
    const db = this.getDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Sync Service class
 */
export class SyncService {
  private store: OfflineStore;
  private isOnline: boolean;
  private syncInProgress = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor() {
    this.store = new OfflineStore();
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    await this.store.initialize();
    console.log('Sync service initialized');
  }

  /**
   * Handle coming online
   */
  private async handleOnline(): Promise<void> {
    console.log('Connection restored');
    this.isOnline = true;
    this.notifyListeners();

    // Attempt to sync pending items
    await this.syncPendingItems();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    console.log('Connection lost');
    this.isOnline = false;
    this.notifyListeners();
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of status change
   */
  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach((callback) => callback(status));
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const queue = await this.store.getAll<SyncQueueItem>(STORES.syncQueue);
    const pendingCount = queue.filter((item) => item.attempts < 3).length;
    const failedCount = queue.filter((item) => item.attempts >= 3).length;

    const lastSync = await this.store.get<{ key: string; value: string }>(
      STORES.settings,
      'lastSyncTime'
    );

    return {
      isOnline: this.isOnline,
      lastSyncTime: lastSync?.value,
      pendingCount,
      failedCount,
    };
  }

  // Session management

  /**
   * Save a session locally
   */
  async saveSession(session: WorkflowSession): Promise<void> {
    await this.store.put(STORES.sessions, session);

    // If online, also queue for remote sync
    if (this.isOnline) {
      await this.addToQueue('session', 'update', session);
    }
  }

  /**
   * Load a session by ID
   */
  async loadSession(sessionId: string): Promise<WorkflowSession | undefined> {
    return this.store.get<WorkflowSession>(STORES.sessions, sessionId);
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<WorkflowSession[]> {
    return this.store.getAll<WorkflowSession>(STORES.sessions);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.store.delete(STORES.sessions, sessionId);
  }

  // Translation caching

  /**
   * Cache a translation for offline use
   */
  async cacheTranslation(
    sourceText: string,
    response: TranslationResponse,
    sourceLang: string,
    targetLang: string,
    domain: string
  ): Promise<void> {
    const id = `${sourceLang}_${targetLang}_${hashString(sourceText)}`;

    const cached: CachedTranslation = {
      id,
      sourceText,
      targetText: response.translatedText,
      sourceLang,
      targetLang,
      domain,
      confidence: response.confidence?.overall || 0,
      timestamp: new Date().toISOString(),
      accessCount: 1,
    };

    await this.store.put(STORES.translations, cached);
  }

  /**
   * Look up a cached translation
   */
  async getCachedTranslation(
    sourceText: string,
    sourceLang: string,
    targetLang: string
  ): Promise<CachedTranslation | undefined> {
    const id = `${sourceLang}_${targetLang}_${hashString(sourceText)}`;
    const cached = await this.store.get<CachedTranslation>(STORES.translations, id);

    if (cached) {
      // Update access count
      cached.accessCount++;
      await this.store.put(STORES.translations, cached);
    }

    return cached;
  }

  /**
   * Clear old cached translations
   */
  async cleanupCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const all = await this.store.getAll<CachedTranslation>(STORES.translations);
    const now = Date.now();
    let deleted = 0;

    for (const item of all) {
      const age = now - new Date(item.timestamp).getTime();
      if (age > maxAge && item.accessCount < 5) {
        await this.store.delete(STORES.translations, item.id);
        deleted++;
      }
    }

    return deleted;
  }

  // Sync queue management

  /**
   * Add item to sync queue
   */
  async addToQueue(
    type: SyncQueueItem['type'],
    operation: SyncQueueItem['operation'],
    data: unknown
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      operation,
      data,
      timestamp: new Date().toISOString(),
      attempts: 0,
    };

    await this.store.put(STORES.syncQueue, item);
    this.notifyListeners();
  }

  /**
   * Get pending sync items
   */
  async getPendingItems(): Promise<SyncQueueItem[]> {
    const all = await this.store.getAll<SyncQueueItem>(STORES.syncQueue);
    return all.filter((item) => item.attempts < 3);
  }

  /**
   * Sync pending items to server
   */
  async syncPendingItems(): Promise<{ synced: number; failed: number }> {
    if (this.syncInProgress || !this.isOnline) {
      return { synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let synced = 0;
    let failed = 0;

    try {
      const pending = await this.getPendingItems();

      for (const item of pending) {
        try {
          await this.syncItem(item);
          await this.store.delete(STORES.syncQueue, item.id);
          synced++;
        } catch (error) {
          item.attempts++;
          item.lastAttempt = new Date().toISOString();
          item.error = error instanceof Error ? error.message : 'Unknown error';
          await this.store.put(STORES.syncQueue, item);
          failed++;
        }
      }

      // Update last sync time
      await this.store.put(STORES.settings, {
        key: 'lastSyncTime',
        value: new Date().toISOString(),
      });

      this.notifyListeners();
    } finally {
      this.syncInProgress = false;
    }

    return { synced, failed };
  }

  /**
   * Sync a single item (implement actual API calls here)
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    // In production, this would make actual API calls
    // For now, we just simulate success
    console.log(`Syncing ${item.type} (${item.operation}):`, item.data);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      throw new Error('Simulated sync failure');
    }
  }

  /**
   * Clear failed items from queue
   */
  async clearFailedItems(): Promise<number> {
    const all = await this.store.getAll<SyncQueueItem>(STORES.syncQueue);
    let cleared = 0;

    for (const item of all) {
      if (item.attempts >= 3) {
        await this.store.delete(STORES.syncQueue, item.id);
        cleared++;
      }
    }

    this.notifyListeners();
    return cleared;
  }

  /**
   * Retry failed items
   */
  async retryFailedItems(): Promise<void> {
    const all = await this.store.getAll<SyncQueueItem>(STORES.syncQueue);

    for (const item of all) {
      if (item.attempts >= 3) {
        item.attempts = 0;
        item.error = undefined;
        await this.store.put(STORES.syncQueue, item);
      }
    }

    this.notifyListeners();
    await this.syncPendingItems();
  }
}

// Utility function for hashing
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Singleton instance
export const syncService = new SyncService();
