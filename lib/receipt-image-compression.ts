export interface CompressReceiptImageOptions {
  maxDimension?: number;
  quality?: number;
}

// Parses the minimal EXIF Orientation tag (0x0112) out of a JPEG's APP1
// segment. Returns 1 (no rotation) for anything that isn't a JPEG, has no
// EXIF data, or fails to parse — the compression pipeline treats 1 as "draw
// as-is", so this is always a safe default.
export function readJpegOrientation(buffer: ArrayBuffer): number {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      if (marker === 0xffda) break; // start of scan: no more metadata markers

      const segmentLength = view.getUint16(offset + 2);
      if (marker === 0xffe1) {
        const exifStart = offset + 4;
        const isExif = view.getUint32(exifStart) === 0x45786966 && view.getUint16(exifStart + 4) === 0x0000;
        if (!isExif) return 1;

        const tiffStart = exifStart + 6;
        const littleEndian = view.getUint16(tiffStart) === 0x4949;
        const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
        const ifd0Start = tiffStart + ifd0Offset;
        const entryCount = view.getUint16(ifd0Start, littleEndian);

        for (let i = 0; i < entryCount; i++) {
          const entryStart = ifd0Start + 2 + i * 12;
          const tag = view.getUint16(entryStart, littleEndian);
          if (tag === 0x0112) {
            return view.getUint16(entryStart + 8, littleEndian);
          }
        }
        return 1;
      }

      offset += 2 + segmentLength;
    }
    return 1;
  } catch {
    return 1;
  }
}

function applyOrientationTransform(ctx: CanvasRenderingContext2D, orientation: number, sourceWidth: number, sourceHeight: number) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, sourceWidth, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, sourceWidth, sourceHeight);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, sourceHeight);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, sourceHeight, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, sourceHeight, sourceWidth);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, sourceWidth);
      break;
    default:
      break;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob returned null'));
      },
      type,
      quality
    );
  });
}

async function drawOrientedAndScaled(
  bitmap: ImageBitmap,
  orientation: number,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const swapped = orientation >= 5 && orientation <= 8;
  const logicalWidth = swapped ? sourceHeight : sourceWidth;
  const logicalHeight = swapped ? sourceWidth : sourceHeight;

  const orientCanvas = document.createElement('canvas');
  orientCanvas.width = logicalWidth;
  orientCanvas.height = logicalHeight;
  const orientCtx = orientCanvas.getContext('2d');
  if (!orientCtx) throw new Error('2d canvas context unavailable');
  applyOrientationTransform(orientCtx, orientation, sourceWidth, sourceHeight);
  orientCtx.drawImage(bitmap, 0, 0);

  const scale = Math.min(1, maxDimension / Math.max(logicalWidth, logicalHeight));
  const targetWidth = Math.round(logicalWidth * scale);
  const targetHeight = Math.round(logicalHeight * scale);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = targetWidth;
  outputCanvas.height = targetHeight;
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) throw new Error('2d canvas context unavailable');
  outputCtx.drawImage(orientCanvas, 0, 0, logicalWidth, logicalHeight, 0, 0, targetWidth, targetHeight);

  return canvasToBlob(outputCanvas, 'image/jpeg', quality);
}

function toJpegFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot === -1 ? name : name.slice(0, dot)) + '.jpg';
}

// Resizes an uploaded receipt photo to a 1600px-longest-side JPEG and
// corrects for EXIF rotation, so what lands in Supabase Storage is already
// the final, upright, bandwidth-friendly version. createImageBitmap is
// called with { imageOrientation: 'none' } deliberately — browsers disagree
// on whether they auto-apply EXIF rotation by default, so orientation is
// read and applied by hand for a deterministic result across browsers.
export async function compressReceiptImage(file: File, options: CompressReceiptImageOptions = {}): Promise<File> {
  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.8;

  if (!file.type.startsWith('image/')) return file;

  try {
    const orientation = file.type === 'image/jpeg' ? readJpegOrientation(await file.arrayBuffer()) : 1;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
    try {
      const blob = await drawOrientedAndScaled(bitmap, orientation, maxDimension, quality);
      return new File([blob], toJpegFileName(file.name), { type: 'image/jpeg' });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
