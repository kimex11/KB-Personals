// Pure, dependency-free TypeScript -- see priority.ts's header comment for
// why (imported by both the Deno Edge Function runtime and vitest/Node).
//
// This app has one user base, in the Philippines (UTC+8, no DST). Supabase
// Edge Functions run in UTC, so every "today"/"now" comparison in the sweep
// -- due-date state and quiet hours -- needs to be computed in Philippines
// time rather than the server's. Shifting the UTC instant forward 8 hours
// and reading its UTC getters gives Philippines wall-clock fields without
// depending on the Deno runtime's own system timezone.

const PH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

function getPhilippinesNow(nowMs: number): Date {
  return new Date(nowMs + PH_UTC_OFFSET_MS);
}

export function philippinesTodayISO(nowMs: number = Date.now()): string {
  return getPhilippinesNow(nowMs).toISOString().slice(0, 10);
}

export function philippinesNowMinutes(nowMs: number = Date.now()): number {
  const phNow = getPhilippinesNow(nowMs);
  return phNow.getUTCHours() * 60 + phNow.getUTCMinutes();
}
