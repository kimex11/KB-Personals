'use client';

import { useEffect, useRef } from 'react';
import { showNotification, clearAppBadge } from './notifications';
import { playNotificationSound } from './notification-sound';

export interface AlertItem {
  id: string;
  title: string;
  body: string;
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
    const notifiedIds = notifiedIdsRef.current!;
    const newItems = items.filter((item) => !notifiedIds.has(item.id));

    // Nothing new to surface — the user has already viewed/acknowledged
    // everything currently active (or there's nothing overdue at all).
    // Clear the home-screen badge rather than leaving a stale count.
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
      // Badge reflects only newly-surfaced/unread items, not the running
      // total — previously-viewed overdue items shouldn't keep padding it.
      (navigator as Navigator & { setAppBadge: (count: number) => Promise<void> })
        .setAppBadge(newItems.length)
        .catch(() => {});
    }
  }, [items, soundEnabled]);

  return { activeAlertCount: items.length };
}
