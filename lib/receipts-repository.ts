import { createClient } from './supabase/client';
import type { StoredReceipt } from './receipts-types';
import type { ExtractedReceiptFields } from './receipt-ocr-types';

const BUCKET = 'receipts';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface ReceiptRow {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  merchant: string | null;
  receipt_date: string | null;
  amount: number | null;
  linked_bill_id: string | null;
}

async function getSignedPreviewUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return '';
  return data.signedUrl;
}

function rowToStoredReceipt(row: ReceiptRow, previewUrl: string): StoredReceipt {
  return {
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    previewUrl,
    uploadedAt: row.created_at,
    merchant: row.merchant ?? null,
    receiptDate: row.receipt_date ?? null,
    amount: row.amount ?? null,
    linkedBillId: row.linked_bill_id ?? null,
  };
}

export async function uploadReceipt(file: File): Promise<StoredReceipt> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const storagePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
  if (uploadError) throw uploadError;

  const { data: row, error: insertError } = await supabase
    .from('receipts')
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  const previewUrl = await getSignedPreviewUrl(storagePath);
  return rowToStoredReceipt(row as ReceiptRow, previewUrl);
}

export async function listReceipts(): Promise<StoredReceipt[]> {
  const supabase = createClient();
  const userId = await requireUserId(supabase);
  const { data: rows, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return Promise.all(
    ((rows ?? []) as ReceiptRow[]).map(async (row) => rowToStoredReceipt(row, await getSignedPreviewUrl(row.storage_path)))
  );
}

async function requireUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export async function deleteReceipt(id: string, storagePath: string): Promise<void> {
  const supabase = createClient();
  const userId = await requireUserId(supabase);
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('receipts').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function updateReceiptFields(id: string, fields: ExtractedReceiptFields): Promise<void> {
  const supabase = createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from('receipts')
    .update({
      merchant: fields.merchant,
      receipt_date: fields.date,
      amount: fields.amount,
    })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function linkReceiptToBill(id: string, billId: string | null): Promise<void> {
  const supabase = createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from('receipts').update({ linked_bill_id: billId }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
