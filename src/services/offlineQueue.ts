/**
 * offlineQueue.ts — Offline Write Queue
 *
 * When a write to Supabase fails (network error), the operation is pushed
 * to a persistent AsyncStorage queue.  On reconnect the queue is flushed
 * with exponential back-off.
 *
 * Usage:
 *   import { offlineQueue } from './offlineQueue';
 *
 *   // Instead of silent catch:
 *   try {
 *     await supabase.from('activities').insert(payload);
 *   } catch (err) {
 *     await offlineQueue.push({ operation: 'insert', table: 'activities', payload });
 *   }
 *
 *   // In App.tsx / a context, start the flush listener:
 *   offlineQueue.startFlushListener();
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ── Types ──────────────────────────────────────────────────────────────────

export type QueueOperation = 'insert' | 'update' | 'upsert' | 'delete';

export interface QueuedWrite {
  /** Unique ID for deduplication */
  id: string;
  operation: QueueOperation;
  /** Supabase table name */
  table: string;
  payload: Record<string, unknown>;
  /** Optional: row ID for update/delete */
  rowId?: string | number;
  timestamp: number;
  retryCount: number;
}

type FlushResult = { success: number; failed: number };

// ── Constants ──────────────────────────────────────────────────────────────

const QUEUE_KEY = '@epexfit_offline_queue';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

// ── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function backoffDelay(retryCount: number): number {
  // Exponential: 2s, 4s, 8s, 16s, 32s
  return BASE_DELAY_MS * Math.pow(2, retryCount);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Queue store ────────────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedWrite[];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedWrite[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

// ── Execute a single queued operation ─────────────────────────────────────

async function executeWrite(item: QueuedWrite): Promise<void> {
  // Lazy import to avoid circular dependency
  const { supabase } = await import('./supabase');
  const ref = supabase.from(item.table);

  let error: unknown = null;

  if (item.operation === 'insert') {
    const { error: e } = await ref.insert(item.payload as never);
    error = e;
  } else if (item.operation === 'upsert') {
    const { error: e } = await ref.upsert(item.payload as never);
    error = e;
  } else if (item.operation === 'update' && item.rowId !== undefined) {
    const { error: e } = await ref.update(item.payload as never).eq('id', item.rowId);
    error = e;
  } else if (item.operation === 'delete' && item.rowId !== undefined) {
    const { error: e } = await ref.delete().eq('id', item.rowId);
    error = e;
  }

  if (error) throw error;
}

// ── Public API ─────────────────────────────────────────────────────────────

export const offlineQueue = {
  /**
   * Push a failed write to the queue.
   */
  async push(opts: Omit<QueuedWrite, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queue = await readQueue();
    const item: QueuedWrite = {
      ...opts,
      id: generateId(),
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(item);
    await writeQueue(queue);
    if (__DEV__) console.log(`[offlineQueue] Queued ${opts.operation} on ${opts.table} (total: ${queue.length})`);
  },

  /**
   * Returns the current queue length (useful for UI badge).
   */
  async size(): Promise<number> {
    const queue = await readQueue();
    return queue.length;
  },

  /**
   * Flush all pending writes.  Call this when the device comes back online.
   */
  async flush(): Promise<FlushResult> {
    const queue = await readQueue();
    if (queue.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;
    const remaining: QueuedWrite[] = [];

    for (const item of queue) {
      try {
        await executeWrite(item);
        success++;
        if (__DEV__) console.log(`[offlineQueue] Flushed ${item.operation}/${item.table} (id: ${item.id})`);
      } catch (err) {
        const nextRetry = item.retryCount + 1;
        if (nextRetry >= MAX_RETRIES) {
          failed++;
          if (__DEV__) console.warn(`[offlineQueue] Dropped ${item.id} after ${MAX_RETRIES} retries`);
        } else {
          remaining.push({ ...item, retryCount: nextRetry });
          failed++;
          // Wait before next attempt (exponential back-off)
          await sleep(backoffDelay(nextRetry));
        }
      }
    }

    await writeQueue(remaining);
    if (__DEV__) console.log(`[offlineQueue] Flush complete — success: ${success}, failed: ${failed}, pending: ${remaining.length}`);
    return { success, failed };
  },

  /**
   * Start listening for reconnect events and flush automatically.
   * Call once from App.tsx or a top-level context.
   * Returns an unsubscribe function.
   */
  startFlushListener(): () => void {
    let wasOffline = false;

    // FIX: typed NetInfoState parameter — eliminates TS7006 implicit any errors
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected === true && state.isInternetReachable !== false;

      const justCameOnline = wasOffline && isConnected;

      if (!isConnected) {
        wasOffline = true;
        if (__DEV__) console.log('[offlineQueue] Device went offline');
      } else if (justCameOnline) {
        wasOffline = false;
        if (__DEV__) console.log('[offlineQueue] Reconnected — flushing queue');
        offlineQueue.flush().catch((err) => {
          if (__DEV__) console.warn('[offlineQueue] Flush error:', err);
        });
      } else if (isConnected && !wasOffline) {
        wasOffline = false;
      }
    });

    // Also check on mount if already online
    // FIX: typed NetInfoState parameter — eliminates TS7006 implicit any error
    NetInfo.fetch().then((state: NetInfoState) => {
      if (state.isConnected === true) {
        if (__DEV__) console.log('[offlineQueue] Already online on mount, checking queue...');
        offlineQueue.flush().catch((err) => {
          if (__DEV__) console.warn('[offlineQueue] Initial flush error:', err);
        });
      }
    });

    return unsubscribe;
  },

  /**
   * Clear the entire queue (use for debugging / settings screen).
   */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
    if (__DEV__) console.log('[offlineQueue] Queue cleared');
  },

  /**
   * Get all pending items (for debugging)
   */
  async getPending(): Promise<QueuedWrite[]> {
    return await readQueue();
  },
};

export default offlineQueue;