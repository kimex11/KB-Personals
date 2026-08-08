'use client';

import { useEffect, useRef } from 'react';
import { showNotification, clearAppBadge } from './notifications';
import { playNotificationSound } from './notification-sound';
import { listSentStateKeys } from './notification-log-repository';
import type { NotificationPriority } from './notification-priority';

export interface AlertItem {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  entityType: 'bill' | 'reminder';
  entityId: string;
  stateKey: string;
}

interface UseOverdueAlertsOptions {
  soundEnabled?: boolean;
}

const STORAGE_KEY = 'kb-personals-notified-alert-ids';

function loadNotifiedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage may be unavailable (private browsing, quota) — non-critical.
  }
}

export function useOverdueAlerts(items: AlertItem[], options: UseOverdueAlertsOptions = {}) {
  const { soundEnabled = true } = options;
  const notifiedIdsRef = useRef<Set<string> | null>(null);
  if (notifiedIdsRef.current === null) {
    notifiedIdsRef.current = loadNotifiedIds();
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const notifiedIds = notifiedIdsRef.current!;
      const sentByServer = await listSentStateKeys();
      if (cancelled) return;

      const newItems = items.filter((item) => {
        const serverKey = `${item.entityType}:${item.entityId}:${item.stateKey}`;
        return !notifiedIds.has(item.id) && !sentByServer.has(serverKey);
      });

      if (newItems.length === 0) {
        clearAppBadge();
        return;
      }

      for (const item of newItems) {
        showNotification(item.title, { body: item.body });
        notifiedIds.add(item.id);
      }
      saveNotifiedIds(notifiedIds);

      if (soundEnabled) {
        playNotificationSound();
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }

      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        (navigator as Navigator & { setAppBadge: (count: number) => Promise<void> })
          .setAppBadge(newItems.length)
          .catch(() => {});
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [items, soundEnabled]);

  return { activeAlertCount: items.length };
}
