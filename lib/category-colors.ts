export const CATEGORY_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Written as literal class names (not built via template literals) so
// Tailwind's content scanner can find every candidate at build time --
// dynamically-assembled class strings aren't reliably picked up.
export const STROKE_COLOR_CLASS: Record<number, string> = {
  1: 'stroke-budget-1',
  2: 'stroke-budget-2',
  3: 'stroke-budget-3',
  4: 'stroke-budget-4',
  5: 'stroke-budget-5',
  6: 'stroke-budget-6',
  7: 'stroke-budget-7',
  8: 'stroke-budget-8',
  9: 'stroke-budget-9',
  10: 'stroke-budget-10',
  11: 'stroke-budget-11',
  12: 'stroke-budget-12',
};

export const DOT_COLOR_CLASS: Record<number, string> = {
  1: 'bg-budget-1',
  2: 'bg-budget-2',
  3: 'bg-budget-3',
  4: 'bg-budget-4',
  5: 'bg-budget-5',
  6: 'bg-budget-6',
  7: 'bg-budget-7',
  8: 'bg-budget-8',
  9: 'bg-budget-9',
  10: 'bg-budget-10',
  11: 'bg-budget-11',
  12: 'bg-budget-12',
};

export const BAR_COLOR_CLASS: Record<number, string> = DOT_COLOR_CLASS;

export const ICON_BG_COLOR_CLASS: Record<number, string> = {
  1: 'bg-budget-1/15',
  2: 'bg-budget-2/15',
  3: 'bg-budget-3/15',
  4: 'bg-budget-4/15',
  5: 'bg-budget-5/15',
  6: 'bg-budget-6/15',
  7: 'bg-budget-7/15',
  8: 'bg-budget-8/15',
  9: 'bg-budget-9/15',
  10: 'bg-budget-10/15',
  11: 'bg-budget-11/15',
  12: 'bg-budget-12/15',
};

export const ICON_TEXT_COLOR_CLASS: Record<number, string> = {
  1: 'text-budget-1',
  2: 'text-budget-2',
  3: 'text-budget-3',
  4: 'text-budget-4',
  5: 'text-budget-5',
  6: 'text-budget-6',
  7: 'text-budget-7',
  8: 'text-budget-8',
  9: 'text-budget-9',
  10: 'text-budget-10',
  11: 'text-budget-11',
  12: 'text-budget-12',
};

export const CARD_TINT_COLOR_CLASS: Record<number, string> = {
  1: 'bg-budget-1/8',
  2: 'bg-budget-2/8',
  3: 'bg-budget-3/8',
  4: 'bg-budget-4/8',
  5: 'bg-budget-5/8',
  6: 'bg-budget-6/8',
  7: 'bg-budget-7/8',
  8: 'bg-budget-8/8',
  9: 'bg-budget-9/8',
  10: 'bg-budget-10/8',
  11: 'bg-budget-11/8',
  12: 'bg-budget-12/8',
};
