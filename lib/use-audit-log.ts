'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listAuditLog, type AuditLogEntry } from './audit-log-repository';

export interface UseAuditLogResult {
  entries: AuditLogEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAuditLog(): UseAuditLogResult {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await listAuditLog();
      if (requestId !== requestIdRef.current) return;
      setEntries(rows);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load activity log');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
