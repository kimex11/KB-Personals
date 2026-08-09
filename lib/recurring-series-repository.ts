import { createClient } from './supabase/client';
import type { RecurringSeries, CreateSeriesInput, SeriesStatus } from './recurring-types';

interface SeriesRow {
  id: string;
  entity_type: string;
  frequency: string;
  custom_interval_unit: string | null;
  custom_interval_count: number | null;
  amount_mode: string;
  auto_renew: boolean;
  end_date: string | null;
  max_occurrences: number | null;
  occurrences_generated: number;
  status: string;
}

function rowToSeries(row: SeriesRow): RecurringSeries {
  return {
    id: row.id,
    entityType: row.entity_type as RecurringSeries['entityType'],
    frequency: row.frequency as RecurringSeries['frequency'],
    customIntervalUnit: row.custom_interval_unit as RecurringSeries['customIntervalUnit'],
    customIntervalCount: row.custom_interval_count,
    amountMode: row.amount_mode as RecurringSeries['amountMode'],
    autoRenew: row.auto_renew,
    endDate: row.end_date,
    maxOccurrences: row.max_occurrences,
    occurrencesGenerated: row.occurrences_generated,
    status: row.status as SeriesStatus,
  };
}

export async function createSeries(input: CreateSeriesInput): Promise<RecurringSeries> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recurring_series')
    .insert({
      entity_type: input.entityType,
      frequency: input.frequency,
      custom_interval_unit: input.customIntervalUnit ?? null,
      custom_interval_count: input.customIntervalCount ?? null,
      amount_mode: input.amountMode ?? 'fixed',
      auto_renew: input.autoRenew ?? true,
      end_date: input.endDate ?? null,
      max_occurrences: input.maxOccurrences ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToSeries(data as SeriesRow);
}

export async function getSeries(id: string): Promise<RecurringSeries> {
  const supabase = createClient();
  const { data, error } = await supabase.from('recurring_series').select('*').eq('id', id).single();
  if (error) throw error;
  return rowToSeries(data as SeriesRow);
}

export async function updateSeriesStatus(id: string, status: SeriesStatus): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('recurring_series').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function incrementOccurrencesGenerated(id: string, newCount: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('recurring_series').update({ occurrences_generated: newCount }).eq('id', id);
  if (error) throw error;
}
