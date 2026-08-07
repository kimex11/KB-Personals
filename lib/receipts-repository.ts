import { createClient } from './supabase/client';
import type { StoredReceipt } from './receipts-types';

const BUCKET = 'receipts';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface ReceiptRow {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
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
  const { data: rows, error } = await supabase.from('receipts').select('*').order('created_at', { ascending: false });
  if (error) throw error;

  return Promise.all(
    ((rows ?? []) as ReceiptRow[]).map(async (row) => rowToStoredReceipt(row, await getSignedPreviewUrl(row.storage_path)))
  );
}

export async function deleteReceipt(id: string, storagePath: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([storagePath]);
  await supabase.from('receipts').delete().eq('id', id);
}
