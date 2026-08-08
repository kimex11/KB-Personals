# Receipts: Capture & Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Receipts tab's capture flow with a split Take Photo / Upload UI, client-side image compression with EXIF-rotation correction, and a fullscreen pinch-zoom viewer for stored receipts.

**Architecture:** A pure `lib/receipt-image-compression.ts` utility (EXIF orientation parsing + canvas-based resize/rotate/re-encode) runs client-side before every upload. A new `ReceiptViewer` component, built on a new `fullscreen` variant of the existing `components/ui/sheet.tsx` Dialog wrapper plus the `react-zoom-pan-pinch` library, opens when a receipt thumbnail is tapped. `ReceiptUploadZone` splits into two capture entry points feeding the same file-selection callback.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Tailwind v4, `@base-ui/react` (Dialog), `react-zoom-pan-pinch` (new dependency), Vitest + React Testing Library, Supabase (unchanged in this phase).

## Global Constraints

- Images only — PDF upload support is removed. `ReceiptUploadZone`'s `accept` narrows to `image/*` and drag/drop filters out non-image files.
- Compression: cap longest side at 1600px, JPEG re-encode at quality 0.8, no upscaling of already-smaller images.
- EXIF orientation is read and applied during compression so rotated phone photos come out upright — this is a side effect of the compression pipeline, not a separate feature.
- New dependency: `react-zoom-pan-pinch` for the viewer's pinch/pan/zoom — do not hand-roll gesture math.
- Viewer opens fullscreen via a new `side="fullscreen"` variant added to the existing `SheetContent` component (`components/ui/sheet.tsx`) — do not build a parallel dialog primitive.
- No database schema changes in this phase. No changes to OCR extraction fields, status, categorization, deduplication, or search/filter (later phases).
- Every new interactive control (camera button, close button) meets the 44×44px minimum touch target, matching the fix already applied to `RowActionsMenu` elsewhere in this codebase (`min-h-11 min-w-11` override on top of the shared `Button` size classes).

---

### Task 1: EXIF-aware receipt image compression utility

**Files:**
- Create: `lib/receipt-image-compression.ts`
- Test: `lib/receipt-image-compression.test.ts`

**Interfaces:**
- Produces: `readJpegOrientation(buffer: ArrayBuffer): number` — returns 1–8, defaults to 1 for non-JPEG/no-EXIF/parse-failure input.
- Produces: `compressReceiptImage(file: File, options?: { maxDimension?: number; quality?: number }): Promise<File>` — returns a new `File` (JPEG, `.jpg` extension) for image input, or the original `file` unchanged for non-image input or on any internal failure. Defaults: `maxDimension` 1600, `quality` 0.8.

- [ ] **Step 1: Write failing tests for `readJpegOrientation`**

Create `lib/receipt-image-compression.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/receipt-image-compression.test.ts`
Expected: FAIL — `readJpegOrientation` / `compressReceiptImage` not exported (module doesn't exist yet).

- [ ] **Step 3: Implement `readJpegOrientation`**

Create `lib/receipt-image-compression.ts` with this first part:

```ts
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
```

- [ ] **Step 4: Run tests to verify the orientation tests pass**

Run: `npx vitest run lib/receipt-image-compression.test.ts`
Expected: The 5 `readJpegOrientation` tests PASS; `compressReceiptImage` tests (added next step) still fail since it isn't implemented yet.

- [ ] **Step 5: Write failing tests for `compressReceiptImage`**

Append to `lib/receipt-image-compression.test.ts`:

```ts
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
    const file = new File([buildJpegWithOrientation(6)], 'receipt.jpg', { type: 'image/jpeg' });

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
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run lib/receipt-image-compression.test.ts`
Expected: FAIL — `compressReceiptImage` not exported.

- [ ] **Step 7: Implement `compressReceiptImage`**

Append to `lib/receipt-image-compression.ts`:

```ts
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
```

- [ ] **Step 8: Run all tests in the file to verify they pass**

Run: `npx vitest run lib/receipt-image-compression.test.ts`
Expected: PASS — all 11 tests (5 orientation + 6 compression).

- [ ] **Step 9: Commit**

```bash
git add lib/receipt-image-compression.ts lib/receipt-image-compression.test.ts
git commit -m "feat: add EXIF-aware receipt image compression utility"
```

---

### Task 2: Fullscreen sheet variant + `ReceiptViewer` component

**Files:**
- Modify: `components/ui/sheet.tsx`
- Create: `components/receipts/ReceiptViewer.tsx`
- Test: `components/receipts/ReceiptViewer.test.tsx`
- Modify: `package.json` (add `react-zoom-pan-pinch`)

**Interfaces:**
- Consumes: `StoredReceipt` from `lib/receipts-types.ts` (existing).
- Produces: `ReceiptViewer({ receipt: StoredReceipt | null, onClose: () => void })` — renders `null` when `receipt` is `null`; otherwise a fullscreen dialog with a pinch/pan/zoom image viewer and a close control.
- Produces: `SheetContent`'s `side` prop now accepts `"fullscreen"` in addition to the existing `"top" | "right" | "bottom" | "left"`.

- [ ] **Step 1: Install `react-zoom-pan-pinch`**

Run: `npm install react-zoom-pan-pinch`
Expected: `package.json` dependencies gain `"react-zoom-pan-pinch": "^4.0.4"` (or newer patch), `package-lock.json` updated.

- [ ] **Step 2: Add the `fullscreen` side variant to `SheetContent`**

In `components/ui/sheet.tsx`, change the `SheetContent` function signature and className:

```tsx
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left" | "fullscreen"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-[side=fullscreen]:inset-0 data-[side=fullscreen]:h-full data-[side=fullscreen]:w-full data-[side=fullscreen]:border-none",
          className
        )}
        {...props}
      >
```

(Only the `side` type union and the appended `data-[side=fullscreen]:...` classes at the end of the string change — everything else in the file stays as-is.)

- [ ] **Step 3: Write failing tests for `ReceiptViewer`**

Create `components/receipts/ReceiptViewer.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceiptViewer } from './ReceiptViewer';
import type { StoredReceipt } from '@/lib/receipts-types';

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => <div data-testid="zoom-wrapper">{children}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div data-testid="zoom-component">{children}</div>,
}));

const receipt: StoredReceipt = {
  id: '1',
  fileName: 'corner-cafe.jpg',
  fileType: 'image/jpeg',
  fileSize: 204800,
  previewUrl: 'https://signed.example/corner-cafe.jpg',
  storagePath: 'user-1/corner-cafe.jpg',
  merchant: null,
  receiptDate: null,
  amount: null,
  linkedBillId: null,
  uploadedAt: '2026-08-15T10:00:00.000Z',
};

describe('ReceiptViewer', () => {
  it('renders nothing when there is no receipt', () => {
    const { container } = render(<ReceiptViewer receipt={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the receipt image and file name', () => {
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} />);
    expect(screen.getByTestId('receipt-viewer-image')).toHaveAttribute('src', receipt.previewUrl);
    expect(screen.getByText('corner-cafe.jpg')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a fallback message when the image fails to load', () => {
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} />);
    fireEvent.error(screen.getByTestId('receipt-viewer-image'));
    expect(screen.getByTestId('receipt-viewer-error')).toBeInTheDocument();
    expect(screen.queryByTestId('receipt-viewer-image')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run components/receipts/ReceiptViewer.test.tsx`
Expected: FAIL — module `./ReceiptViewer` doesn't exist yet.

- [ ] **Step 5: Implement `ReceiptViewer`**

Create `components/receipts/ReceiptViewer.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { XIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { StoredReceipt } from '@/lib/receipts-types';

interface ReceiptViewerProps {
  receipt: StoredReceipt | null;
  onClose: () => void;
}

export function ReceiptViewer({ receipt, onClose }: ReceiptViewerProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!receipt) return null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="fullscreen" showCloseButton={false} className="items-center justify-center bg-black/95">
        <p className="absolute top-4 left-4 right-16 truncate text-sm text-white">{receipt.fileName}</p>
        <SheetClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
            />
          }
        >
          <XIcon className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </SheetClose>
        {imageFailed ? (
          <p data-testid="receipt-viewer-error" className="text-sm text-white">
            Couldn&apos;t load this image.
          </p>
        ) : (
          <TransformWrapper>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- previewUrl is a signed Supabase URL, not an optimizable remote image */}
              <img
                src={receipt.previewUrl}
                alt={receipt.fileName}
                data-testid="receipt-viewer-image"
                className="max-h-full max-w-full object-contain"
                onError={() => setImageFailed(true)}
              />
            </TransformComponent>
          </TransformWrapper>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run components/receipts/ReceiptViewer.test.tsx`
Expected: PASS — all 4 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components/ui/sheet.tsx components/receipts/ReceiptViewer.tsx components/receipts/ReceiptViewer.test.tsx
git commit -m "feat: add fullscreen pinch-zoom receipt viewer"
```

---

### Task 3: Clickable receipt thumbnails (`ReceiptCard` + `ReceiptGrid`)

**Files:**
- Modify: `components/receipts/ReceiptCard.tsx`
- Modify: `components/receipts/ReceiptCard.test.tsx`
- Modify: `components/receipts/ReceiptGrid.tsx`
- Modify: `components/receipts/ReceiptGrid.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ReceiptCard` gains an optional `onView?: (receipt: StoredReceipt) => void` prop. `ReceiptGrid` gains an optional `onView?: (receipt: StoredReceipt) => void` prop, threaded to every `ReceiptCard` it renders.

- [ ] **Step 1: Write failing tests for `ReceiptCard`'s clickable thumbnail**

Add to `components/receipts/ReceiptCard.test.tsx`, inside the existing `describe('ReceiptCard', ...)` block (after the "renders an image preview..." test):

```tsx
  it('calls onView with the receipt when the thumbnail is clicked', () => {
    const onView = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} onView={onView} />);
    fireEvent.click(screen.getByTestId('receipt-thumbnail-button'));
    expect(onView).toHaveBeenCalledWith(imageReceipt);
  });

  it('renders a plain, non-clickable image when onView is not provided', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('receipt-thumbnail-button')).not.toBeInTheDocument();
    expect(screen.getByAltText('electricity-receipt.jpg')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/receipts/ReceiptCard.test.tsx`
Expected: FAIL — no element with `data-testid="receipt-thumbnail-button"`.

- [ ] **Step 3: Implement the clickable thumbnail in `ReceiptCard`**

In `components/receipts/ReceiptCard.tsx`, update the props interface and the thumbnail block:

```tsx
interface ReceiptCardProps {
  receipt: StoredReceipt;
  onRemove: (id: string) => void;
  onView?: (receipt: StoredReceipt) => void;
  ocrStatus?: OcrStatus;
  extractedFields?: ExtractedReceiptFields;
  bills?: LinkableBill[];
  onLinkBill?: (receiptId: string, billId: string | null) => void;
}

export function ReceiptCard({ receipt, onRemove, onView, ocrStatus, extractedFields, bills, onLinkBill }: ReceiptCardProps) {
  const isImage = receipt.fileType.startsWith('image/');

  return (
    <div
      data-testid="receipt-card"
      className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white"
    >
      <div className="flex h-28 items-center justify-center bg-neutral-50">
        {isImage && onView ? (
          <button
            type="button"
            data-testid="receipt-thumbnail-button"
            aria-label={`View ${receipt.fileName} full size`}
            onClick={() => onView(receipt)}
            className="h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, not an optimizable remote image */}
            <img src={receipt.previewUrl} alt={receipt.fileName} className="h-full w-full object-cover" />
          </button>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, not an optimizable remote image
          <img src={receipt.previewUrl} alt={receipt.fileName} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
        )}
      </div>
```

(The rest of the component — file name/size, OCR status block, bill-link select, Remove button — is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/receipts/ReceiptCard.test.tsx`
Expected: PASS — all tests including the 2 new ones.

- [ ] **Step 5: Write failing test for `ReceiptGrid`'s `onView` pass-through**

Add to `components/receipts/ReceiptGrid.test.tsx`, inside the `describe` block:

```tsx
  it('passes onView through to each card', () => {
    const onView = vi.fn();
    const receipts: StoredReceipt[] = [
      { id: '1', fileName: 'a.jpg', fileType: 'image/jpeg', fileSize: 1000, previewUrl: 'blob:a', storagePath: 'user-1/a.jpg', merchant: null, receiptDate: null, amount: null, linkedBillId: null, uploadedAt: '2026-08-15T10:00:00.000Z' },
    ];
    render(<ReceiptGrid receipts={receipts} onRemove={vi.fn()} onView={onView} />);
    fireEvent.click(screen.getByTestId('receipt-thumbnail-button'));
    expect(onView).toHaveBeenCalledWith(receipts[0]);
  });
```

Add `fireEvent` to the existing `import { render, screen } from '@testing-library/react';` line, changing it to `import { render, screen, fireEvent } from '@testing-library/react';`.

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run components/receipts/ReceiptGrid.test.tsx`
Expected: FAIL — `onView` not passed through, no thumbnail button rendered.

- [ ] **Step 7: Implement `onView` pass-through in `ReceiptGrid`**

In `components/receipts/ReceiptGrid.tsx`:

```tsx
interface ReceiptGridProps {
  receipts: StoredReceipt[];
  onRemove: (id: string) => void;
  onView?: (receipt: StoredReceipt) => void;
  ocrStatusById?: Record<string, OcrStatus>;
  ocrResultById?: Record<string, ExtractedReceiptFields>;
  bills?: LinkableBill[];
  onLinkBill?: (receiptId: string, billId: string | null) => void;
}

export function ReceiptGrid({
  receipts,
  onRemove,
  onView,
  ocrStatusById,
  ocrResultById,
  bills,
  onLinkBill,
}: ReceiptGridProps) {
  if (receipts.length === 0) {
    return <EmptyState message="No receipts uploaded yet." />;
  }

  return (
    <div data-testid="receipt-grid" className="grid grid-cols-2 gap-3">
      {receipts.map((receipt) => (
        <ReceiptCard
          key={receipt.id}
          receipt={receipt}
          onRemove={onRemove}
          onView={onView}
          ocrStatus={ocrStatusById?.[receipt.id]}
          extractedFields={ocrResultById?.[receipt.id]}
          bills={bills}
          onLinkBill={onLinkBill}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run components/receipts/ReceiptGrid.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/receipts/ReceiptCard.tsx components/receipts/ReceiptCard.test.tsx components/receipts/ReceiptGrid.tsx components/receipts/ReceiptGrid.test.tsx
git commit -m "feat: make receipt thumbnails open the fullscreen viewer"
```

---

### Task 4: `ReceiptUploadZone` — images-only + Take Photo button

**Files:**
- Modify: `components/receipts/ReceiptUploadZone.tsx`
- Modify: `components/receipts/ReceiptUploadZone.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: same `onFilesSelected: (files: File[]) => void` prop as today; now only ever called with image files (non-images filtered out of drops; file inputs restrict via `accept="image/*"`).

- [ ] **Step 1: Write the failing/updated test file**

Replace the full contents of `components/receipts/ReceiptUploadZone.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceiptUploadZone } from './ReceiptUploadZone';

function makeFile(name: string, type: string) {
  return new File(['content'], name, { type });
}

describe('ReceiptUploadZone', () => {
  it('calls onFilesSelected with the chosen files when the file input changes', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('receipt.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-file-input'), { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('calls onFilesSelected with dropped image files', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('receipt.png', 'image/png');
    fireEvent.drop(screen.getByTestId('receipt-upload-zone'), { dataTransfer: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('filters out non-image files dropped onto the zone', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('invoice.pdf', 'application/pdf');
    fireEvent.drop(screen.getByTestId('receipt-upload-zone'), { dataTransfer: { files: [file] } });
    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it('opens the file picker on Enter for keyboard-only users', () => {
    render(<ReceiptUploadZone onFilesSelected={vi.fn()} />);
    const input = screen.getByTestId('receipt-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.keyDown(screen.getByTestId('receipt-upload-zone'), { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('opens the file picker on Space for keyboard-only users', () => {
    render(<ReceiptUploadZone onFilesSelected={vi.fn()} />);
    const input = screen.getByTestId('receipt-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.keyDown(screen.getByTestId('receipt-upload-zone'), { key: ' ' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('renders a Take Photo button with a camera-capture input', () => {
    render(<ReceiptUploadZone onFilesSelected={vi.fn()} />);
    const cameraInput = screen.getByTestId('receipt-camera-input') as HTMLInputElement;
    expect(cameraInput).toHaveAttribute('accept', 'image/*');
    expect(cameraInput).toHaveAttribute('capture', 'environment');
  });

  it('opens the camera input when Take Photo is clicked', () => {
    render(<ReceiptUploadZone onFilesSelected={vi.fn()} />);
    const cameraInput = screen.getByTestId('receipt-camera-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(cameraInput, 'click');
    fireEvent.click(screen.getByTestId('receipt-camera-button'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('calls onFilesSelected with the photo captured via the camera input', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('photo.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-camera-input'), { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/receipts/ReceiptUploadZone.test.tsx`
Expected: FAIL — no `receipt-camera-input`/`receipt-camera-button`, PDF drop test fails (still calls `onFilesSelected`).

- [ ] **Step 3: Implement the split capture UI**

Replace the full contents of `components/receipts/ReceiptUploadZone.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { Camera, UploadCloud } from 'lucide-react';

interface ReceiptUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export function ReceiptUploadZone({ onFilesSelected }: ReceiptUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList: FileList | null | undefined) {
    if (!fileList || fileList.length === 0) return;
    const images = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;
    onFilesSelected(images);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        data-testid="receipt-upload-zone"
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
          isDragging ? 'border-gold bg-gold/5' : 'border-neutral-200'
        }`}
      >
        <UploadCloud className="h-8 w-8 text-neutral-400" strokeWidth={1.5} />
        <p className="text-sm font-medium text-neutral-700">Tap to upload or drag a receipt here</p>
        <p className="text-xs text-neutral-400">Images only</p>
        <input
          ref={inputRef}
          data-testid="receipt-file-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <button
        type="button"
        data-testid="receipt-camera-button"
        onClick={() => cameraInputRef.current?.click()}
        className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700"
      >
        <Camera className="h-4 w-4" />
        Take Photo
      </button>
      <input
        ref={cameraInputRef}
        data-testid="receipt-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/receipts/ReceiptUploadZone.test.tsx`
Expected: PASS — all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add components/receipts/ReceiptUploadZone.tsx components/receipts/ReceiptUploadZone.test.tsx
git commit -m "feat: split receipt capture into Take Photo and Upload, images only"
```

---

### Task 5: Wire compression and the viewer into the Receipts page

**Files:**
- Modify: `app/(shell)/receipts/page.tsx`
- Modify: `app/(shell)/receipts/page.test.tsx`

**Interfaces:**
- Consumes: `compressReceiptImage` from Task 1, `ReceiptViewer` from Task 2, `ReceiptGrid`'s `onView` prop from Task 3.
- Produces: nothing new externally — this task is pure wiring inside the page component.

- [ ] **Step 1: Write failing tests for compression-before-upload and the viewer**

In `app/(shell)/receipts/page.test.tsx`, add the mock for the compression module near the top (after the `receipts-repository` mock):

```tsx
const compressReceiptImageMock = vi.fn(async (file: File) => file);

vi.mock('@/lib/receipt-image-compression', () => ({
  compressReceiptImage: (file: File) => compressReceiptImageMock(file),
}));

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => <div data-testid="zoom-wrapper">{children}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div data-testid="zoom-component">{children}</div>,
}));
```

Add these two tests at the end of the `describe('ReceiptsPage', ...)` block, before the closing `});`:

```tsx
  it('compresses the image before uploading it', async () => {
    listReceiptsMock.mockResolvedValue([]);
    const newReceipt: StoredReceipt = {
      id: 'receipt-5',
      fileName: 'new.jpg',
      fileType: 'image/jpeg',
      fileSize: 2000,
      previewUrl: 'https://signed.example/new.jpg',
      storagePath: 'user-1/new.jpg',
      merchant: null,
      receiptDate: null,
      amount: null,
      linkedBillId: null,
      uploadedAt: '2026-08-15T11:00:00.000Z',
    };
    uploadReceiptMock.mockResolvedValue(newReceipt);

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());

    const original = makeFile('new.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-file-input'), { target: { files: [original] } });

    await waitFor(() => expect(uploadReceiptMock).toHaveBeenCalled());
    expect(compressReceiptImageMock).toHaveBeenCalledWith(original);
    const compressOrder = compressReceiptImageMock.mock.invocationCallOrder[0];
    const uploadOrder = uploadReceiptMock.mock.invocationCallOrder[0];
    expect(compressOrder).toBeLessThan(uploadOrder);
  });

  it('opens the fullscreen viewer when a receipt thumbnail is clicked, and closes it', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);
    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('receipt-thumbnail-button'));
    expect(screen.getByTestId('receipt-viewer-image')).toHaveAttribute('src', existingReceipt.previewUrl);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTestId('receipt-viewer-image')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/(shell)/receipts/page.test.tsx"`
Expected: FAIL — `compressReceiptImageMock` never called; no thumbnail button / viewer rendered.

- [ ] **Step 3: Wire compression and the viewer into the page**

In `app/(shell)/receipts/page.tsx`, update the imports:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ReceiptUploadZone } from '@/components/receipts/ReceiptUploadZone';
import { ReceiptGrid } from '@/components/receipts/ReceiptGrid';
import { ReceiptViewer } from '@/components/receipts/ReceiptViewer';
import { useReceiptOcr } from '@/lib/use-receipt-ocr';
import { listReceipts, uploadReceipt, deleteReceipt, updateReceiptFields, linkReceiptToBill } from '@/lib/receipts-repository';
import { compressReceiptImage } from '@/lib/receipt-image-compression';
import { useBills } from '@/lib/use-bills';
import type { StoredReceipt } from '@/lib/receipts-types';
import type { ExtractedReceiptFields, OcrStatus } from '@/lib/receipt-ocr-types';
```

Add viewer state next to the existing `error` state:

```tsx
  const [receipts, setReceipts] = useState<StoredReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerReceipt, setViewerReceipt] = useState<StoredReceipt | null>(null);
```

Update `handleFilesSelected` to compress before uploading:

```tsx
  async function handleFilesSelected(files: File[]) {
    setError(null);
    for (const file of files) {
      try {
        const compressed = await compressReceiptImage(file);
        const receipt = await uploadReceipt(compressed);
        setReceipts((prev) => [receipt, ...prev]);
        processReceipt(receipt.id, compressed);
      } catch {
        setError('Could not upload receipt.');
      }
    }
  }
```

Update the JSX to pass `onView` to `ReceiptGrid` and render `ReceiptViewer`:

```tsx
      {isLoading ? (
        <p data-testid="receipts-loading" className="text-center text-sm text-neutral-400">
          Loading receipts…
        </p>
      ) : (
        <ReceiptGrid
          receipts={receipts}
          onRemove={handleRemove}
          onView={setViewerReceipt}
          ocrStatusById={mergedStatusById}
          ocrResultById={mergedResultById}
          bills={linkableBills}
          onLinkBill={handleLinkBill}
        />
      )}
      <ReceiptViewer
        key={viewerReceipt?.id ?? 'none'}
        receipt={viewerReceipt}
        onClose={() => setViewerReceipt(null)}
      />
    </div>
  );
}
```

(The `key={viewerReceipt?.id ?? 'none'}` forces `ReceiptViewer` to remount — and so reset its internal zoom/error state — whenever a different receipt is opened.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/(shell)/receipts/page.test.tsx"`
Expected: PASS — all tests including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add "app/(shell)/receipts/page.tsx" "app/(shell)/receipts/page.test.tsx"
git commit -m "feat: compress receipts before upload and wire up the fullscreen viewer"
```

---

### Task 6: Full validation pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: All test files pass, including every file touched in Tasks 1–5.

- [ ] **Step 2: Run TypeScript checks**

Run: `npx tsc --noEmit`
Expected: No output, exit code 0.

- [ ] **Step 3: Run ESLint**

Run: `npx eslint .`
Expected: No output, exit code 0. (If the new `<button>`-wrapped `<img>` in `ReceiptCard` or the `<img>` in `ReceiptViewer` trigger `@next/next/no-img-element`, confirm the existing `eslint-disable-next-line` comments are directly above each `<img>` tag.)

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: Build succeeds, `/receipts` route listed among the generated static pages, no new warnings.

- [ ] **Step 5: Manual smoke check (dev server)**

Run: `npm run dev`, sign in, navigate to `/receipts`, and verify:
- Both "Take Photo" and the drag/drop zone are visible.
- Uploading an image shows it in the grid.
- Tapping a receipt thumbnail opens the fullscreen viewer with pinch/scroll zoom working and a close button that returns to the grid.

Stop the dev server after checking (`Ctrl+C`, or `lsof -ti:3000 | xargs kill` if backgrounded).

- [ ] **Step 6: Commit and push**

```bash
git status --short
git push origin main
```

(No new files expected at this point — Step 6 is a checkpoint to push the 5 commits from Tasks 1–5 if they haven't been pushed yet.)
