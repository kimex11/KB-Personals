export interface StoredReceipt {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl: string;
  storagePath: string;
  uploadedAt: string; // ISO datetime
  merchant: string | null;
  receiptDate: string | null;
  amount: number | null;
  linkedBillId: string | null;
  description: string | null;
}
