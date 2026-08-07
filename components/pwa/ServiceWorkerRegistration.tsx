'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failure shouldn't break the app — it's a progressive enhancement.
      });
    }
  }, []);

  return null;
}
