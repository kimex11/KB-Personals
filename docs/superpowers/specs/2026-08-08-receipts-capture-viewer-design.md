# Receipts: Capture & Viewer (Phase 1 of Smart Receipt Capture)

## Context

The Receipts tab today: drag/drop or file-picker upload (`ReceiptUploadZone`), receipts stored in Supabase Storage + `receipts` table, a flat 2-column grid of thumbnails (`ReceiptGrid`/`ReceiptCard`) with basic Tesseract OCR (merchant/date/amount only, no review step), and a plain `<select>` to link a receipt to a bill.

This is Phase 1 of a larger "Smart Receipt Capture & OCR Enhancement" initiative, scoped down from the full request into four independently-shippable phases:

1. **Capture & Viewer** (this spec) — preview/zoom/fullscreen viewing, mobile capture flow, image compression
2. Smart Extraction & Review — richer OCR fields, confidence scoring, editable review step, status field
3. Intelligence & Linking — auto-categorize, suggest linking, duplicate detection
4. History & Search — filters, sort, search

Phase 1 touches capture, compression, and viewing only. No OCR/schema/status changes.

## Decisions

- **File types narrow to images only.** PDF upload support is dropped — camera photos are the real use case this feature targets. Simplifies the viewer, compression, and (in later phases) OCR pipeline. `ReceiptUploadZone`'s `accept` attribute and file-type validation drop `application/pdf`.
- **Two separate capture controls**: "Take Photo" (`<input type="file" accept="image/*" capture="environment">`, opens the camera directly on mobile) and "Upload" (existing drag/drop zone + file picker, unchanged interaction). Removes ambiguity on mobile vs. today's single combined zone.
- **Client-side compression before upload**: cap longest side at 1600px, re-encode JPEG at ~80% quality. Runs in the browser via canvas before `uploadReceipt` is called, so what lands in Storage is already the compressed version — no duplicate original kept, no schema change needed.
- **EXIF orientation normalized during compression.** The canvas redraw reads the image's EXIF orientation tag and rotates the pixels accordingly before resizing, so sideways/upside-down phone photos come out upright. This is a side effect of the compression pipeline, not a separate feature — it directly serves the "handle rotated receipts" edge case from the broader request.
- **Zoom viewer uses `react-zoom-pan-pinch`** (new dependency, ~15KB) rather than hand-rolled pointer-event gesture math. Multi-touch pinch-distance tracking, momentum, and bounds clamping are easy to get subtly wrong; the app already takes on small focused libraries for exactly this class of problem (e.g. `@dnd-kit` for drag-and-drop).
- **Viewer opens fullscreen from a tap on any receipt thumbnail**, built as a `Dialog` reusing the existing `components/ui/sheet.tsx` base-ui pattern (not a new dialog primitive).

## Architecture

### `lib/receipt-image-compression.ts` (new)

```
compressReceiptImage(file: File): Promise<File>
```

- Loads the file into an `Image`/`createImageBitmap`, reads EXIF orientation via a minimal JPEG EXIF parser (no new dependency — hand-rolled, ~30 lines, only needs the orientation tag).
- Draws to an off-screen `<canvas>`, applying the rotation/flip implied by the orientation tag, then scales so the longest side is ≤1600px (no upscaling if the source is already smaller).
- Exports via `canvas.toBlob('image/jpeg', 0.8)`, wraps the result back into a `File` with the original name (extension normalized to `.jpg` if it changes format) and `image/jpeg` type.
- If the input isn't an image (shouldn't occur once PDF is dropped from the accept list, but a defensive check stays), returns the file unchanged.
- Pure function, no React dependency — testable by feeding in a synthetic canvas-drawn `File` and asserting the output is smaller/correctly-typed. EXIF-rotation logic gets its own focused unit tests against known orientation-tag byte sequences.

### `components/receipts/ReceiptUploadZone.tsx` (modified)

- `accept` narrows to `image/*`; PDF branch in any type-checking logic removed.
- Adds a `Take Photo` button rendered alongside the existing drag/drop zone (not replacing it) — a separate hidden `<input type="file" accept="image/*" capture="environment">` triggered on click, wired to the same `onFilesSelected` callback as the existing zone.
- Both entry points call `onFilesSelected(files)` with the raw (uncompressed) files, same as today — compression is the caller's responsibility (see below), keeping this component a dumb file-selection surface.

### `app/(shell)/receipts/page.tsx` (modified)

- `handleFilesSelected` runs each file through `compressReceiptImage` before calling `uploadReceipt`, same try/catch-per-file structure as today.
- Adds `viewerReceipt: StoredReceipt | null` state; passes an `onOpenViewer` callback down through `ReceiptGrid` → `ReceiptCard`.

### `components/receipts/ReceiptViewer.tsx` (new)

- Props: `receipt: StoredReceipt | null`, `onClose: () => void`.
- Renders `null` when `receipt` is null (mirrors `ConfirmDeleteDialog`'s conditional-render pattern already used elsewhere in this codebase).
- A fullscreen `Dialog`/`SheetContent`-style overlay (full viewport, not the existing bottom-sheet variant — a new `side="fullscreen"` or a dedicated wrapper, whichever fits `sheet.tsx`'s existing variant system with least duplication) containing:
  - Header: filename, close button (`X`, top-right, min 44×44px touch target).
  - Body: `TransformWrapper` (`react-zoom-pan-pinch`) with `TransformComponent` wrapping an `<img>` pointed at `receipt.previewUrl` (the existing signed URL, already full-resolution).
  - Pinch-to-zoom, double-tap-to-zoom, and drag-to-pan on touch; wheel-zoom and drag-to-pan on desktop — all provided by the library's defaults, no custom gesture code.
  - Resets zoom/pan state each time a different receipt is opened (component remounts via `key={receipt.id}` from the parent, or an internal reset-on-prop-change effect).

### `components/receipts/ReceiptCard.tsx` (modified)

- Thumbnail `<img>` becomes clickable (`role="button"`, `aria-label="View {fileName} full size"`), calling a new `onView: (receipt: StoredReceipt) => void` prop. Remove/Link controls stay exactly as they are today — this only adds a way to open the viewer, doesn't change existing actions.

## Error handling & edge cases

- **Compression failure** (corrupt image, canvas/toBlob unsupported): `compressReceiptImage` catches internally and returns the original file unchanged rather than blocking the upload — a slightly larger upload beats a failed one.
- **EXIF parse failure or missing orientation tag**: treated as orientation `1` (no rotation needed), same as no EXIF data at all.
- **Viewer opened for a receipt whose signed URL has expired**: existing `getSignedPreviewUrl` TTL is 1 hour; if it fails to load, the `<img>`'s `onError` shows a simple inline "Couldn't load this image" message in the viewer body instead of a broken-image icon.

## Testing

- `lib/receipt-image-compression.test.ts`: output is a `File`/`Blob` of `image/jpeg` type; longest side clamped to 1600px for an oversized synthetic input; no upscaling for a smaller input; EXIF orientation cases (at least: no EXIF, orientation 1, orientation 6/90°-rotated) produce correctly-dimensioned output; non-image input passed through unchanged; internal errors don't throw (caller never needs a try/catch).
- `components/receipts/ReceiptUploadZone.test.tsx`: existing drag/drop tests updated for `image/*`-only accept; new tests for the Take Photo button (renders, has `capture="environment"`, triggers `onFilesSelected` on file selection).
- `components/receipts/ReceiptViewer.test.tsx`: renders `null` for `receipt: null`; renders image + filename for a given receipt; close button calls `onClose`; renders a fallback message when the image fails to load (simulated `onError`).
- `components/receipts/ReceiptCard.test.tsx`: thumbnail click calls `onView` with the receipt; existing Remove/Link tests unchanged.
- `app/(shell)/receipts/page.test.tsx`: `compressReceiptImage` mocked and asserted called before `uploadReceipt` in `handleFilesSelected`; viewer opens/closes via page state.

## Out of scope (later phases)

- OCR field extraction changes, confidence highlighting, review-before-save step, receipt status (Processed/Needs Review/Verified/Failed Scan) — Phase 2.
- Auto-categorization, link-target suggestions, duplicate detection — Phase 3.
- Search/filter/sort across receipt history — Phase 4.
- No database schema changes in this phase.
