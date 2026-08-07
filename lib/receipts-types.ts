export interface StoredReceipt {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl: string;
  uploadedAt: string; // ISO datetime
}
