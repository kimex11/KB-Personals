import { addDays } from 'date-fns';
import type { Reminder } from './reminders-types';
import { toISODateString } from './date-utils';

interface MockReminderSeed {
  dayOffset: number;
  title: string;
  category: string;
  priority: Reminder['priority'];
  completed: boolean;
}

const REMINDER_SEEDS: MockReminderSeed[] = [
  { dayOffset: -4, title: 'Renew car insurance', category: 'Finance', priority: 'high', completed: true },
  { dayOffset: -1, title: 'Call insurance provider', category: 'Finance', priority: 'high', completed: false },
  { dayOffset: 0, title: "Mom's birthday", category: 'Personal', priority: 'medium', completed: false },
  { dayOffset: 1, title: 'Renew passport', category: 'Personal', priority: 'high', completed: false },
  { dayOffset: 3, title: 'Water plants', category: 'Home', priority: 'low', completed: false },
  { dayOffset: 5, title: 'Schedule dentist appointment', category: 'Health', priority: 'medium', completed: false },
  { dayOffset: 8, title: 'Review monthly budget', category: 'Finance', priority: 'medium', completed: false },
  { dayOffset: 12, title: 'Change air filter', category: 'Home', priority: 'low', completed: false },
];

export function generateMockReminders(baseDate: Date = new Date()): Reminder[] {
  return REMINDER_SEEDS.map(({ dayOffset, ...rest }, index) => ({
    id: `reminder-${index}`,
    dueDate: toISODateString(addDays(baseDate, dayOffset)),
    ...rest,
  }));
}

export const mockReminders: Reminder[] = generateMockReminders();
