'use client';

import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { EventCard } from './EventCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { CalendarEvent } from '@/lib/types';

interface DayDetailPanelProps {
  date: Date;
  events: CalendarEvent[];
}

export function DayDetailPanel({ date, events }: DayDetailPanelProps) {
  return (
    <div data-testid="day-detail-panel" className="mt-6 flex flex-col gap-2">
      <p className="text-sm font-medium text-neutral-500">{format(date, 'EEEE, MMMM d')}</p>
      {events.length === 0 ? (
        <EmptyState message="Nothing scheduled" />
      ) : (
        <AnimatePresence mode="popLayout">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <EventCard event={event} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
