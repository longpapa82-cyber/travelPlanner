import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import axios from 'axios';
import { offlineMutationQueue, QueuedMutation } from '../services/offlineMutationQueue';
import { API_URL } from '../constants/config';
import { secureStorage } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/config';

const PING_URL = (API_URL || 'http://localhost:3000/api') + '/health';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check network connectivity
  const checkNetwork = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(PING_URL, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);
      setIsOnline(true);
      return true;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    const count = await offlineMutationQueue.getCount();
    setPendingCount(count);
  }, []);

  // Execute a single queued mutation
  const executeMutation = useCallback(async (mutation: QueuedMutation): Promise<boolean> => {
    try {
      const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const config = {
        method: mutation.method.toLowerCase(),
        url: `${API_URL}${mutation.url}`,
        headers,
        data: mutation.data,
        timeout: 30000,
      };

      await axios(config);
      return true;
    } catch (error: any) {
      // If it's a 4xx error (client error), don't retry
      if (error.response?.status >= 400 && error.response?.status < 500) {
        return true; // Remove from queue — retrying won't help
      }
      return false;
    }
  }, []);

  // Sync all pending mutations
  const syncNow = useCallback(async () => {
    const online = await checkNetwork();
    if (!online) return;

    const count = await offlineMutationQueue.getCount();
    if (count === 0) return;

    setIsSyncing(true);
    try {
      await offlineMutationQueue.flush(executeMutation);
      setLastSyncTime(Date.now());
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [checkNetwork, executeMutation, refreshPendingCount]);

  // Setup network monitoring and auto-sync
  useEffect(() => {
    refreshPendingCount();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        setIsOnline(true);
        syncNow();
      };
      const handleOffline = () => setIsOnline(false);
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // Native: periodic network check
    checkNetwork().then((online) => {
      if (online) syncNow();
    });
    intervalRef.current = setInterval(async () => {
      const wasOffline = !isOnline;
      const nowOnline = await checkNetwork();
      if (wasOffline && nowOnline) {
        syncNow();
      }
    }, 15000);

    // App foreground event
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkNetwork().then((online) => {
          if (online) syncNow();
        });
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncNow,
    lastSyncTime,
    refreshPendingCount,
  };
}
