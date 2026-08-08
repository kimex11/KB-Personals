'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useReminders } from '@/lib/use-reminders';
import { RemindersListView } from '@/components/reminders/RemindersListView';
import { ReminderForm } from '@/components/reminders/ReminderForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';
import type { Reminder } from '@/lib/reminders-types';

function RemindersPageContent() {
  const isMounted = useIsMounted();
  const searchParams = useSearchParams();
  const { reminders, loading, error, createReminder, updateReminder, deleteReminder, toggleComplete, snooze } = useReminders();

  const [formOpen, setFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  // Tracks which ?open= value has already been processed, so the deep-link
  // open only happens once even though this runs in the render body on
  // every render — the React-endorsed pattern for adjusting state in
  // response to an external value (the URL) without an effect. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [handledOpenId, setHandledOpenId] = useState<string | null>(null);
  const openId = searchParams.get('open');
  if (!loading && openId && openId !== handledOpenId) {
    setHandledOpenId(openId);
    const target = reminders.find((reminder) => reminder.id === openId);
    if (target) {
      setEditingReminder(target);
      setFormOpen(true);
    }
  }

  function openAddForm() {
    setEditingReminder(undefined);
    setFormOpen(true);
  }

  function openEditForm(reminder: Reminder) {
    setEditingReminder(reminder);
    setFormOpen(true);
  }

  async function handleSubmit(input: { title: string; category: string; dueDate: string; priority: Reminder['priority'] }) {
    if (editingReminder) {
      await updateReminder(editingReminder.id, input);
    } else {
      await createReminder(input);
    }
  }

  return (
    <div data-testid="reminders-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAddForm}>
          <Plus className="h-4 w-4" />
          Add Reminder
        </Button>
      </div>
      {error && <p className="text-sm text-status-critical">{error}</p>}
      {isMounted && loading && (
        <p data-testid="reminders-loading" className="text-center text-sm text-neutral-400">
          Loading reminders…
        </p>
      )}
      {isMounted && !loading && (
        <RemindersListView
          reminders={reminders}
          onToggleComplete={toggleComplete}
          onSnooze={snooze}
          referenceDate={new Date()}
          onEdit={openEditForm}
          onDelete={setDeleteTarget}
        />
      )}

      <ReminderForm
        key={`${editingReminder?.id ?? 'new'}-${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        initialReminder={editingReminder}
        onSubmit={handleSubmit}
      />
      {deleteTarget && (
        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={`Delete ${deleteTarget.title}?`}
          description="This can't be undone."
          onConfirm={() => deleteReminder(deleteTarget.id)}
        />
      )}
    </div>
  );
}

export default function RemindersPage() {
  return (
    <Suspense fallback={null}>
      <RemindersPageContent />
    </Suspense>
  );
}
