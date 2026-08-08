'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useReminders } from '@/lib/use-reminders';
import { RemindersListView } from '@/components/reminders/RemindersListView';
import { ReminderForm } from '@/components/reminders/ReminderForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';
import type { Reminder } from '@/lib/reminders-types';

export default function RemindersPage() {
  const isMounted = useIsMounted();
  const { reminders, loading, error, createReminder, updateReminder, deleteReminder, toggleComplete, snooze } = useReminders();

  const [formOpen, setFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);

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
