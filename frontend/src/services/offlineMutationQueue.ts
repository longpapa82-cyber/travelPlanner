import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@travelplanner:mutation_queue';

export interface QueuedMutation {
  id: string;
  method: 'PATCH' | 'POST' | 'DELETE';
  url: string;
  data?: any;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
}

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
};

let cachedQueue: QueuedMutation[] | null = null;

async function loadQueue(): Promise<QueuedMutation[]> {
  if (cachedQueue !== null) return cachedQueue;
  try {
    const raw = await storage.getItem(QUEUE_KEY);
    cachedQueue = raw ? JSON.parse(raw) : [];
    return cachedQueue!;
  } catch {
    cachedQueue = [];
    return [];
  }
}

async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  cachedQueue = queue;
  try {
    await storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full — silently fail
  }
}

export const offlineMutationQueue = {
  async enqueue(mutation: Omit<QueuedMutation, 'id' | 'retryCount' | 'createdAt'>): Promise<QueuedMutation> {
    const queue = await loadQueue();
    const entry: QueuedMutation = {
      ...mutation,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      retryCount: 0,
      createdAt: Date.now(),
    };
    queue.push(entry);
    await saveQueue(queue);
    return entry;
  },

  async dequeue(id: string): Promise<void> {
    const queue = await loadQueue();
    await saveQueue(queue.filter((m) => m.id !== id));
  },

  async getAll(): Promise<QueuedMutation[]> {
    return loadQueue();
  },

  async getCount(): Promise<number> {
    const queue = await loadQueue();
    return queue.length;
  },

  async incrementRetry(id: string): Promise<QueuedMutation | null> {
    const queue = await loadQueue();
    const item = queue.find((m) => m.id === id);
    if (!item) return null;
    item.retryCount += 1;
    await saveQueue(queue);
    return item;
  },

  async flush(
    executor: (mutation: QueuedMutation) => Promise<boolean>,
  ): Promise<{ succeeded: number; failed: number }> {
    const queue = await loadQueue();
    let succeeded = 0;
    let failed = 0;

    // Process in order (FIFO)
    const remaining: QueuedMutation[] = [];
    for (const mutation of queue) {
      try {
        const ok = await executor(mutation);
        if (ok) {
          succeeded++;
        } else {
          mutation.retryCount++;
          if (mutation.retryCount < mutation.maxRetries) {
            remaining.push(mutation);
          }
          failed++;
        }
      } catch {
        mutation.retryCount++;
        if (mutation.retryCount < mutation.maxRetries) {
          remaining.push(mutation);
        }
        failed++;
      }
    }

    await saveQueue(remaining);
    return { succeeded, failed };
  },

  async clear(): Promise<void> {
    await saveQueue([]);
  },
};
