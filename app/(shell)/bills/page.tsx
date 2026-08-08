'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { DayDetailPanel } from '@/components/calendar/DayDetailPanel';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useIsMounted } from '@/lib/use-is-mounted';
import { useBills } from '@/lib/use-bills';
import { useReminders } from '@/lib/use-reminders';
import { useCategories } from '@/lib/use-categories';
import { BillsListView } from '@/components/bills/BillsListView';
import { BillForm } from '@/components/bills/BillForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import type { Bill } from '@/lib/bills-types';

function BillsPageContent() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const isMounted = useIsMounted();
  const searchParams = useSearchParams();

  const { bills, loading, error, createBill, updateBill, deleteBill, togglePaid } = useBills();
  const { reminders } = useReminders();
  const { getEventsForDate } = useCalendarEvents(bills, reminders);
  const { activeCategories } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<(Bill & { categoryId: string }) | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  // Tracks which ?open= value has already been processed, so the deep-link
  // open only happens once even though this runs in the render body on
  // every render — the React-endorsed pattern for adjusting state in
  // response to an external value (the URL) without an effect. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [handledOpenId, setHandledOpenId] = useState<string | null>(null);
  const openId = searchParams.get('open');
  if (!loading && openId && openId !== handledOpenId) {
    setHandledOpenId(openId);
    const target = bills.find((bill) => bill.id === openId);
    if (target) {
      setEditingBill(target as Bill & { categoryId: string });
      setFormOpen(true);
    }
  }

  function openAddForm() {
    setEditingBill(undefined);
    setFormOpen(true);
  }

  function openEditForm(bill: Bill) {
    setEditingBill(bill as Bill & { categoryId: string });
    setFormOpen(true);
  }

  async function handleSubmit(input: { title: string; categoryId: string; amount: number; dueDate: string; recurrence: Bill['recurrence'] }) {
    if (editingBill) {
      await updateBill(editingBill.id, input);
    } else {
      await createBill(input);
    }
  }

  return (
    <div data-testid="bills-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex items-center justify-between">
        <div data-testid="bills-view-toggle" className="flex gap-2">
          <Button
            data-testid="bills-view-list"
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('list')}
          >
            List
          </Button>
          <Button
            data-testid="bills-view-calendar"
            variant={view === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('calendar')}
          >
            Calendar
          </Button>
        </div>
        <Button size="sm" onClick={openAddForm}>
          <Plus className="h-4 w-4" />
          Add Bill
        </Button>
      </div>
      {error && <p className="text-sm text-status-critical">{error}</p>}
      {isMounted && loading && (
        <p data-testid="bills-loading" className="text-center text-sm text-neutral-400">
          Loading bills…
        </p>
      )}
      {isMounted &&
        !loading &&
        (view === 'list' ? (
          <BillsListView
            bills={bills}
            onTogglePaid={togglePaid}
            referenceDate={new Date()}
            onEdit={openEditForm}
            onDelete={setDeleteTarget}
          />
        ) : (
          <>
            <MonthGrid getEventsForDate={getEventsForDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <DayDetailPanel date={selectedDate} events={getEventsForDate(selectedDate)} />
          </>
        ))}

      <BillForm
        key={`${editingBill?.id ?? 'new'}-${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={activeCategories}
        initialBill={editingBill}
        onSubmit={handleSubmit}
      />
      {deleteTarget && (
        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={`Delete ${deleteTarget.title}?`}
          description="This can't be undone."
          onConfirm={() => deleteBill(deleteTarget.id)}
        />
      )}
    </div>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={null}>
      <BillsPageContent />
    </Suspense>
  );
}
