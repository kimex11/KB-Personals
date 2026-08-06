'use client';

import { useState, useSyncExternalStore } from 'react';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { DayDetailPanel } from '@/components/calendar/DayDetailPanel';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

function subscribeNoop() {
  return () => {};
}

// True once mounted on the client, false during the server render and the
// client's first (hydration) pass. useSyncExternalStore is the React-
// recommended tool for exactly this "defer to client-only" scenario: its
// server snapshot and its first client snapshot are both `false`, so
// server HTML and the client's initial render agree — nothing to
// hydration-mismatch — and it flips to `true` right after mount without a
// manual setState-in-effect.
function useIsMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export default function HomePage() {
  const isMounted = useIsMounted();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { getEventsForDate } = useCalendarEvents();

  return (
    <div data-testid="home-page" className="flex flex-col px-4 pb-24 pt-4">
      {isMounted && (
        <>
          <MonthGrid
            getEventsForDate={getEventsForDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <DayDetailPanel date={selectedDate} events={getEventsForDate(selectedDate)} />
          <div className="pointer-events-none fixed inset-x-0 bottom-24 mx-auto max-w-md">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    data-testid="add-event-button"
                    aria-label="Add event"
                    className="pointer-events-auto absolute bottom-0 right-4 h-14 w-14 rounded-full bg-neutral-900 text-2xl text-white shadow-lg"
                  />
                }
              >
                +
              </SheetTrigger>
              <SheetContent side="bottom" data-testid="add-event-sheet">
                <p className="py-8 text-center text-neutral-500">Coming soon</p>
              </SheetContent>
            </Sheet>
          </div>
        </>
      )}
    </div>
  );
}
