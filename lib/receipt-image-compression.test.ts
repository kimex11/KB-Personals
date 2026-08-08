import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readJpegOrientation, compressReceiptImage } from './receipt-image-compression';

function buildJpegWithOrientation(orientation: number): Uint8Array {
  const body: number[] = [];
  body.push(0x45, 0x78, 0x69, 0x66, 0x00, 0x00); // 'Exif\0\0'
  body.push(0x49, 0x49); // 'II' little-endian
  body.push(0x2a, 0x00); // TIFF magic 42
  body.push(0x08, 0x00, 0x00, 0x00); // IFD0 offset = 8 (relative to TIFF header start)
  body.push(0x01, 0x00); // 1 IFD0 entry
  body.push(0x12, 0x01); // tag 0x0112 (Orientation)
  body.push(0x03, 0x00); // type SHORT
  body.push(0x01, 0x00, 0x00, 0x00); // count = 1
  body.push(orientation & 0xff, (orientation >> 8) & 0xff, 0x00, 0x00); // value
  body.push(0x00, 0x00, 0x00, 0x00); // next IFD offset = 0

  const segmentLength = body.length + 2;
  const bytes: number[] = [0xff, 0xd8, 0xff, 0xe1, (segmentLength >> 8) & 0xff, segmentLength & 0xff, ...body, 0xff, 0xd9];
  return new Uint8Array(bytes);
}

describe('readJpegOrientation', () => {
  it('returns 1 for a JPEG with no EXIF data', () => {
    expect(readJpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBe(1);
  });

  it('returns 1 for non-JPEG input', () => {
    expect(readJpegOrientation(new Uint8Array([0x00, 0x01, 0x02]).buffer)).toBe(1);
  });

  it('reads orientation 1 from a minimal EXIF segment', () => {
    expect(readJpegOrientation(buildJpegWithOrientation(1).buffer)).toBe(1);
  });

  it('reads orientation 6 (rotated 90°) from a minimal EXIF segment', () => {
    expect(readJpegOrientation(buildJpegWithOrientation(6).buffer)).toBe(6);
  });

  it('returns 1 instead of throwing on a truncated/corrupt EXIF segment', () => {
    const truncated = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78]);
    expect(readJpegOrientation(truncated.buffer)).toBe(1);
  });
});

interface FakeCanvasContext {
  transform: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
}

describe('compressReceiptImage', () => {
  let canvases: HTMLCanvasElement[];
  let contexts: FakeCanvasContext[];

  beforeEach(() => {
    canvases = [];
    contexts = [];

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'canvas') canvases.push(el as HTMLCanvasElement);
      return el;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      const ctx: FakeCanvasContext = { transform: vi.fn(), drawImage: vi.fn() };
      contexts.push(ctx);
      return ctx as unknown as CanvasRenderingContext2D;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback) {
      callback(new Blob(['fake'], { type: 'image/jpeg' }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('clamps an oversized image to 1600px on its longest side', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' });

    const result = await compressReceiptImage(file);

    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('receipt.jpg');
    expect(canvases[1].width).toBe(1600);
    expect(canvases[1].height).toBe(1200);
  });

  it('does not upscale an image already smaller than the cap', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })));
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' });

    await compressReceiptImage(file);

    expect(canvases[1].width).toBe(800);
    expect(canvases[1].height).toBe(600);
  });

  it('renames a non-jpeg source to a .jpg extension', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })));
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });

    const result = await compressReceiptImage(file);

    expect(result.name).toBe('receipt.jpg');
    expect(result.type).toBe('image/jpeg');
  });

  it('applies a 90° EXIF orientation correction and swaps the output dimensions', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
    const file = new File([buildJpegWithOrientation(6).slice()], 'receipt.jpg', { type: 'image/jpeg' });

    await compressReceiptImage(file);

    // orientCanvas (canvases[0]) is sized to the logical (post-rotation) dimensions
    expect(canvases[0].width).toBe(3000);
    expect(canvases[0].height).toBe(4000);
    // outputCanvas (canvases[1]) scales logical 3000x4000 down to fit 1600 longest side
    expect(canvases[1].width).toBe(1200);
    expect(canvases[1].height).toBe(1600);
  });

  it('passes non-image files through unchanged', async () => {
    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
    const result = await compressReceiptImage(file);
    expect(result).toBe(file);
  });

  it('returns the original file unchanged if bitmap decoding fails', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed');
      })
    );
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' });

    const result = await compressReceiptImage(file);

    expect(result).toBe(file);
  });
});
