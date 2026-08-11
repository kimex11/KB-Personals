'use client';

import { useAuditLog } from '@/lib/use-audit-log';
import { ActivityLogList } from '@/components/activity/ActivityLogList';
import { useIsMounted } from '@/lib/use-is-mounted';

export default function ActivityPage() {
  const isMounted = useIsMounted();
  const { entries, loading, error } = useAuditLog();

  return (
    <div data-testid="activity-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      {error && <p className="text-sm text-status-critical">{error}</p>}
      {isMounted && loading && (
        <p data-testid="activity-loading" className="text-center text-sm text-neutral-400">
          Loading activity…
        </p>
      )}
      {isMounted && !loading && <ActivityLogList entries={entries} />}
    </div>
  );
}
