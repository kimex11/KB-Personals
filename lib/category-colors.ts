export const CATEGORY_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function buildColorMap(prefix: string): Record<number, string> {
  return CATEGORY_COLOR_SLOTS.reduce<Record<number, string>>((map, slot) => {
    map[slot] = `${prefix}-budget-${slot}`;
    return map;
  }, {});
}

export const STROKE_COLOR_CLASS: Record<number, string> = buildColorMap('stroke');
export const DOT_COLOR_CLASS: Record<number, string> = buildColorMap('bg');
export const BAR_COLOR_CLASS: Record<number, string> = buildColorMap('bg');
