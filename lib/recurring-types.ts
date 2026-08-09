export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom';
export type CustomIntervalUnit = 'day' | 'week' | 'month';
export type AmountMode = 'fixed' | 'editable';
export type SeriesStatus = 'active' | 'paused' | 'stopped';
export type EntityType = 'bill' | 'reminder';

export interface RecurringSeries {
  id: string;
  entityType: EntityType;
  frequency: Frequency;
  customIntervalUnit: CustomIntervalUnit | null;
  customIntervalCount: number | null;
  amountMode: AmountMode;
  autoRenew: boolean;
  endDate: string | null;
  maxOccurrences: number | null;
  occurrencesGenerated: number;
  status: SeriesStatus;
}

export interface CreateSeriesInput {
  entityType: EntityType;
  frequency: Frequency;
  customIntervalUnit?: CustomIntervalUnit;
  customIntervalCount?: number;
  amountMode?: AmountMode;
  autoRenew?: boolean;
  endDate?: string | null;
  maxOccurrences?: number | null;
}
