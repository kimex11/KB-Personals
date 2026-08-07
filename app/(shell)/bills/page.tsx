'use client';

import { useState } from 'react';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { DayDetailPanel } from '@/components/calendar/DayDetailPanel';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useIsMounted } from '@/lib/use-is-mounted';
import { mockBills } from '@/lib/bills-data';
import { BillsListView } from '@/components/bills/BillsListView';
import { Button } from '@/components/ui/button';

export default function BillsPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [paidOverrides, setPaidOverrides] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { getEventsForDate } = useCalendarEvents();
  const isMounted = useIsMounted();

  const bills = mockBills.map((bill) => ({
    ...bill,
    paid: bill.paid || paidOverrides.has(bill.id),
  }));

  function togglePaid(id: string) {
    setPaidOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div data-testid="bills-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
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
      {isMounted &&
        (view === 'list' ? (
          <BillsListView bills={bills} onTogglePaid={togglePaid} referenceDate={new Date()} />
        ) : (
          <>
            <MonthGrid getEventsForDate={getEventsForDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <DayDetailPanel date={selectedDate} events={getEventsForDate(selectedDate)} />
          </>
        ))}
    </div>
  );
}
