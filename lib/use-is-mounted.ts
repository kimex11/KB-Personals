'use client';

import { useSyncExternalStore } from 'react';

function subscribeNoop() {
  return () => {};
}

// True once mounted on the client, false during the server render and the
// client's first (hydration) pass. Pages here are statically prerendered at
// build time, so anything reading `new Date()` (e.g. the calendar's "today"
// ring) would otherwise disagree between the build-time HTML and the
// client's actual current date and trigger a hydration mismatch.
// useSyncExternalStore's server snapshot and first client snapshot are both
// `false`, so they agree on first paint, then flip to `true` right after
// mount without a manual setState-in-effect.
export function useIsMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}
