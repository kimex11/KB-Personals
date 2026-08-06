'use client';

import { useState } from 'react';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { DayDetailPanel } from '@/components/calendar/DayDetailPanel';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { getEventsForDate } = useCalendarEvents();

  return (
    <div data-testid="home-page" className="flex flex-col px-4 pb-24 pt-4">
      <MonthGrid getEventsForDate={getEventsForDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      <DayDetailPanel date={selectedDate} events={getEventsForDate(selectedDate)} />
      <Sheet>
        <SheetTrigger
          render={
            <Button
              data-testid="add-event-button"
              aria-label="Add event"
              className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-neutral-900 text-2xl text-white shadow-lg"
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
  );
}
