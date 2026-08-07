import { createWorker } from 'tesseract.js';

export async function extractTextFromImage(file: File): Promise<string> {
  const worker = await createWorker('eng');
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text;
  } finally {
    await worker.terminate();
  }
}
