# Activity Log — Phase 5 (wire into Categories + Receipts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the Activity Log's entity coverage — Categories (create, edit, archive, unarchive, delete, merge) and Receipts (upload, rename, remove, description update, bill link/unlink) each write `audit_log` entries, following the pattern Phases 2-4 established.

**Architecture:** Categories follows the exact `lib/use-accounts.ts` shape from Phase 4 (a `runMutation` helper, no offline queueing) — `logActivity` calls live in `lib/use-categories.ts`. Receipts is different: there is no `lib/use-receipts.ts` hook — `app/(shell)/receipts/page.tsx` calls `lib/receipts-repository.ts` functions directly from its own handler functions (`handleFilesSelected`, `handleRename`, `handleUpdateDescription`, `handleRemove`, `handleLinkBill`), each already holding the "before" state in the page's own `receipts` array. `logActivity` calls go directly into those handlers.

**Tech Stack:** React 19, TypeScript, vitest + @testing-library/react.

## Global Constraints

- No change to any `lib/categories-repository.ts` or `lib/receipts-repository.ts` function signature or behavior.
- Every `logActivity` call is fire-and-forget (`.catch(() => {})`).
- `reorderCategories` (drag-to-reorder on Manage Categories) is **deliberately not logged** — a reorder produces a whole-list id ordering with no single meaningful "before/after" value to show, and it's not in the original requirements' list of tracked actions (create/edit/update/delete/upload/link/approve). Logging every drag would also be noisy relative to its audit value. This is a scope decision, not an oversight.
- `handleLinkBill(receiptId, billId)` logs `action: 'link'` when `billId` is non-null and `action: 'unlink'` when `billId` is `null` (clearing a link).

---

### Task 1: Wire `logActivity` into every `useCategories` mutation

**Files:**
- Modify: `lib/use-categories.ts`
- Modify: `lib/use-categories.test.ts`

**Interfaces:**
- Consumes: `logActivity` from `./audit-log-repository` (Phase 1).
- No changes to `UseCategoriesResult`'s public shape.

- [ ] **Step 1: Write the failing tests**

In `lib/use-categories.test.ts`, expose every repository function as a named hoisted mock (several are currently inline `vi.fn()`), and add the `audit-log-repository` mock:

```ts
const {
  listCategoriesMock,
  createCategoryMock,
  updateCategoryMock,
  archiveCategoryMock,
  unarchiveCategoryMock,
  deleteCategoryMock,
  mergeCategoriesMock,
  reorderCategoriesMock,
  logActivityMock,
} = vi.hoisted(() => ({
  listCategoriesMock: vi.fn(),
  createCategoryMock: vi.fn(),
  updateCategoryMock: vi.fn(),
  archiveCategoryMock: vi.fn(),
  unarchiveCategoryMock: vi.fn(),
  deleteCategoryMock: vi.fn(),
  mergeCategoriesMock: vi.fn(),
  reorderCategoriesMock: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock('./categories-repository', () => ({
  listCategories: listCategoriesMock,
  createCategory: createCategoryMock,
  updateCategory: updateCategoryMock,
  archiveCategory: archiveCategoryMock,
  unarchiveCategory: unarchiveCategoryMock,
  deleteCategory: deleteCategoryMock,
  mergeCategories: mergeCategoriesMock,
  reorderCategories: reorderCategoriesMock,
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));
```

(replaces the existing `vi.hoisted`/`vi.mock('./categories-repository', ...)` block)

Change the `vitest` import to add `beforeEach`: `import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';` and add, right after the existing `afterEach(() => { vi.clearAllMocks(); });`:

```ts
beforeEach(() => {
  logActivityMock.mockResolvedValue(undefined);
});
```

Add these tests inside `describe('useCategories', ...)`, after `'create() calls the repository and refreshes the list'`:

```ts
  it('create() logs a create activity', async () => {
    listCategoriesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([activeCategory]);
    createCategoryMock.mockResolvedValue(activeCategory);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.create({ name: 'Housing', icon: 'building-2', colorSlot: 1 });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'category', entityId: 'cat-1', entityLabel: 'Housing' })
    );
  });

  it('update() logs an update activity with before and after snapshots', async () => {
    listCategoriesMock.mockResolvedValue([activeCategory]);
    updateCategoryMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update('cat-1', { colorSlot: 3 });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'category',
        entityId: 'cat-1',
        entityLabel: 'Housing',
        beforeValue: expect.objectContaining({ colorSlot: 1 }),
        afterValue: expect.objectContaining({ colorSlot: 3 }),
      })
    );
  });

  it('archive() logs an archive activity', async () => {
    listCategoriesMock.mockResolvedValue([activeCategory]);
    archiveCategoryMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.archive('cat-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'archive',
        entityType: 'category',
        entityId: 'cat-1',
        entityLabel: 'Housing',
        beforeValue: { archived: false },
        afterValue: { archived: true },
      })
    );
  });

  it('unarchive() logs an unarchive activity', async () => {
    listCategoriesMock.mockResolvedValue([archivedCategory]);
    unarchiveCategoryMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.unarchive('cat-2');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'unarchive',
        entityType: 'category',
        entityId: 'cat-2',
        entityLabel: 'Old',
        beforeValue: { archived: true },
        afterValue: { archived: false },
      })
    );
  });

  it('remove() logs a delete activity', async () => {
    listCategoriesMock.mockResolvedValue([activeCategory]);
    deleteCategoryMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove('cat-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entityType: 'category', entityId: 'cat-1', entityLabel: 'Housing' })
    );
  });

  it('merge() logs a merge activity naming both categories', async () => {
    listCategoriesMock.mockResolvedValue([activeCategory, archivedCategory]);
    mergeCategoriesMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.merge('cat-1', 'cat-2');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'merge',
        entityType: 'category',
        entityId: 'cat-1',
        entityLabel: 'Housing',
        beforeValue: { name: 'Housing' },
        afterValue: { mergedInto: 'Old' },
      })
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/use-categories.test.ts`
Expected: FAIL — the 6 new tests fail; all pre-existing tests still pass.

- [ ] **Step 3: Update the implementation**

In `lib/use-categories.ts`, add the import:

```ts
import { logActivity } from './audit-log-repository';
```

Replace the `return { ... }` object's mutation methods (leaving `reorder` as-is, per the Global Constraints note above):

```ts
    create: (input) =>
      runMutation(() =>
        createCategory(input).then((created) => {
          logActivity({
            action: 'create',
            entityType: 'category',
            entityId: created.id,
            entityLabel: created.name,
            afterValue: { name: created.name, icon: created.icon, colorSlot: created.colorSlot },
          }).catch(() => {});
        })
      ),
    update: (id, patch) => {
      const before = categories.find((c) => c.id === id);
      return runMutation(() =>
        updateCategory(id, patch).then(() => {
          logActivity({
            action: 'update',
            entityType: 'category',
            entityId: id,
            entityLabel: patch.name ?? before?.name ?? 'Category',
            beforeValue: before ? { name: before.name, icon: before.icon, colorSlot: before.colorSlot } : null,
            afterValue: { ...before, ...patch },
          }).catch(() => {});
        })
      );
    },
    archive: (id) => {
      const before = categories.find((c) => c.id === id);
      return runMutation(() =>
        archiveCategory(id).then(() => {
          logActivity({
            action: 'archive',
            entityType: 'category',
            entityId: id,
            entityLabel: before?.name ?? 'Category',
            beforeValue: { archived: false },
            afterValue: { archived: true },
          }).catch(() => {});
        })
      );
    },
    unarchive: (id) => {
      const before = categories.find((c) => c.id === id);
      return runMutation(() =>
        unarchiveCategory(id).then(() => {
          logActivity({
            action: 'unarchive',
            entityType: 'category',
            entityId: id,
            entityLabel: before?.name ?? 'Category',
            beforeValue: { archived: true },
            afterValue: { archived: false },
          }).catch(() => {});
        })
      );
    },
    remove: (id, reassignToId) => {
      const before = categories.find((c) => c.id === id);
      return runMutation(() =>
        deleteCategory(id, reassignToId).then(() => {
          logActivity({
            action: 'delete',
            entityType: 'category',
            entityId: id,
            entityLabel: before?.name ?? 'Category',
            beforeValue: before ? { name: before.name, icon: before.icon, colorSlot: before.colorSlot } : null,
          }).catch(() => {});
        })
      );
    },
    merge: (sourceId, targetId) => {
      const source = categories.find((c) => c.id === sourceId);
      const target = categories.find((c) => c.id === targetId);
      return runMutation(() =>
        mergeCategories(sourceId, targetId).then(() => {
          logActivity({
            action: 'merge',
            entityType: 'category',
            entityId: sourceId,
            entityLabel: source?.name ?? 'Category',
            beforeValue: { name: source?.name ?? null },
            afterValue: { mergedInto: target?.name ?? null },
          }).catch(() => {});
        })
      );
    },
    reorder: (orderedIds) => runMutation(() => reorderCategories(orderedIds)),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/use-categories.test.ts`
Expected: PASS (all pre-existing tests plus the 6 new ones)

- [ ] **Step 5: Commit**

```bash
git add lib/use-categories.ts lib/use-categories.test.ts
git commit -m "feat: log category mutations to the Activity Log"
```

---

### Task 2: Wire `logActivity` into the Receipts page handlers

**Files:**
- Modify: `app/(shell)/receipts/page.tsx`
- Modify: `app/(shell)/receipts/page.test.tsx`

**Interfaces:**
- Consumes: `logActivity` from `@/lib/audit-log-repository` (Phase 1).
- No changes to any exported type — this only adds calls inside existing handler functions.

- [ ] **Step 1: Write the failing tests**

In `app/(shell)/receipts/page.test.tsx`, add the mock:

```ts
const logActivityMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit-log-repository', () => ({ logActivity: (input: unknown) => logActivityMock(input) }));
```

(add near the top, alongside the other `vi.mock` calls)

Add these tests inside `describe('ReceiptsPage', ...)`, after `'uploads a new file via the repository and adds it to the list'`:

```ts
  it('logs an upload activity when a file is uploaded', async () => {
    listReceiptsMock.mockResolvedValue([]);
    const newReceipt: StoredReceipt = {
      id: 'receipt-2',
      fileName: 'new.jpg',
      fileType: 'image/jpeg',
      fileSize: 2000,
      previewUrl: 'https://signed.example/new.jpg',
      storagePath: 'user-1/new.jpg',
      merchant: null,
      receiptDate: null,
      amount: null,
      linkedBillId: null,
      description: null,
      uploadedAt: '2026-08-15T11:00:00.000Z',
    };
    uploadReceiptMock.mockResolvedValue(newReceipt);

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('receipt-file-input'), {
      target: { files: [makeFile('new.jpg', 'image/jpeg')] },
    });

    await waitFor(() =>
      expect(logActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'upload', entityType: 'receipt', entityId: 'receipt-2', entityLabel: 'new.jpg' })
      )
    );
  });
```

After `'removes a receipt via the repository when Remove is clicked'`:

```ts
  it('logs a delete activity when a receipt is removed', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);
    deleteReceiptMock.mockResolvedValue(undefined);

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('receipt-remove-button'));

    await waitFor(() =>
      expect(logActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', entityType: 'receipt', entityId: 'receipt-1', entityLabel: 'existing.jpg' })
      )
    );
  });
```

After `'links a receipt to a bill via the bill-link picker'`:

```ts
  it('logs a link activity when a receipt is linked to a bill', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('receipt-bill-link-select'), { target: { value: 'bill-1' } });

    await waitFor(() =>
      expect(logActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'link', entityType: 'receipt', entityId: 'receipt-1', entityLabel: 'existing.jpg', afterValue: { linkedBillId: 'bill-1' } })
      )
    );
  });
```

After `'renames a receipt from the card via the repository'`:

```ts
  it('logs an update activity when a receipt is renamed', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);
    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('receipt-rename-button'));
    fireEvent.change(screen.getByTestId('receipt-name-input'), { target: { value: 'renamed.jpg' } });
    fireEvent.click(screen.getByTestId('receipt-name-save'));

    await waitFor(() =>
      expect(logActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'receipt',
          entityId: 'receipt-1',
          entityLabel: 'renamed.jpg',
          beforeValue: { fileName: 'existing.jpg' },
          afterValue: { fileName: 'renamed.jpg' },
        })
      )
    );
  });
```

After `'saves a description from the card via the repository'`:

```ts
  it('logs an update activity when a description is saved', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);
    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeInTheDocument());

    const input = screen.getByTestId('receipt-description-input');
    fireEvent.change(input, { target: { value: 'Weekly grocery run' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(logActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'receipt',
          entityId: 'receipt-1',
          entityLabel: 'existing.jpg',
          beforeValue: { description: null },
          afterValue: { description: 'Weekly grocery run' },
        })
      )
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(shell)/receipts/page.test.tsx"`
Expected: FAIL — the 5 new tests fail; all pre-existing tests still pass.

- [ ] **Step 3: Update the implementation**

In `app/(shell)/receipts/page.tsx`, add the import:

```tsx
import { logActivity } from '@/lib/audit-log-repository';
```

Update `handleFilesSelected`:

```tsx
  async function handleFilesSelected(files: File[]) {
    setError(null);
    for (const file of files) {
      try {
        const compressed = await compressReceiptImage(file);
        const receipt = await uploadReceipt(compressed);
        setReceipts((prev) => [receipt, ...prev]);
        processReceipt(receipt.id, compressed);
        logActivity({
          action: 'upload',
          entityType: 'receipt',
          entityId: receipt.id,
          entityLabel: receipt.fileName,
          afterValue: { fileName: receipt.fileName, fileSize: receipt.fileSize },
        }).catch(() => {});
      } catch {
        setError('Could not upload receipt.');
      }
    }
  }
```

Update `handleLinkBill`:

```tsx
  async function handleLinkBill(receiptId: string, billId: string | null) {
    const target = receipts.find((r) => r.id === receiptId);
    const previous = target?.linkedBillId ?? null;
    setReceipts((prev) => prev.map((r) => (r.id === receiptId ? { ...r, linkedBillId: billId } : r)));
    try {
      await linkReceiptToBill(receiptId, billId);
      logActivity({
        action: billId ? 'link' : 'unlink',
        entityType: 'receipt',
        entityId: receiptId,
        entityLabel: target?.fileName ?? 'Receipt',
        beforeValue: { linkedBillId: previous },
        afterValue: { linkedBillId: billId },
      }).catch(() => {});
    } catch {
      setError('Could not link receipt to bill.');
      setReceipts((prev) => prev.map((r) => (r.id === receiptId ? { ...r, linkedBillId: previous } : r)));
    }
  }
```

Update `handleRename`:

```tsx
  async function handleRename(id: string, fileName: string) {
    const previous = receipts.find((r) => r.id === id)?.fileName;
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, fileName } : r)));
    setViewerReceipt((prev) => (prev && prev.id === id ? { ...prev, fileName } : prev));
    try {
      await renameReceipt(id, fileName);
      logActivity({
        action: 'update',
        entityType: 'receipt',
        entityId: id,
        entityLabel: fileName,
        beforeValue: previous !== undefined ? { fileName: previous } : null,
        afterValue: { fileName },
      }).catch(() => {});
    } catch {
      setError('Could not rename receipt.');
      if (previous !== undefined) {
        setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, fileName: previous } : r)));
        setViewerReceipt((prev) => (prev && prev.id === id ? { ...prev, fileName: previous } : prev));
      }
    }
  }
```

Update `handleUpdateDescription`:

```tsx
  async function handleUpdateDescription(id: string, description: string | null) {
    const target = receipts.find((r) => r.id === id);
    const previous = target?.description ?? null;
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, description } : r)));
    setViewerReceipt((prev) => (prev && prev.id === id ? { ...prev, description } : prev));
    try {
      await updateReceiptDescription(id, description);
      logActivity({
        action: 'update',
        entityType: 'receipt',
        entityId: id,
        entityLabel: target?.fileName ?? 'Receipt',
        beforeValue: { description: previous },
        afterValue: { description },
      }).catch(() => {});
    } catch {
      setError('Could not update description.');
      setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, description: previous } : r)));
      setViewerReceipt((prev) => (prev && prev.id === id ? { ...prev, description: previous } : prev));
    }
  }
```

Update `handleRemove`:

```tsx
  async function handleRemove(id: string) {
    const target = receipts.find((receipt) => receipt.id === id);
    if (!target) return;

    setReceipts((prev) => prev.filter((receipt) => receipt.id !== id));
    try {
      await deleteReceipt(id, target.storagePath);
      logActivity({
        action: 'delete',
        entityType: 'receipt',
        entityId: id,
        entityLabel: target.fileName,
        beforeValue: { fileName: target.fileName, fileSize: target.fileSize },
      }).catch(() => {});
    } catch {
      setError('Could not delete receipt.');
      setReceipts((prev) => [target, ...prev]);
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/(shell)/receipts/page.test.tsx"`
Expected: PASS (all pre-existing tests plus the 5 new ones)

- [ ] **Step 5: Commit**

```bash
git add "app/(shell)/receipts/page.tsx" "app/(shell)/receipts/page.test.tsx"
git commit -m "feat: log receipt mutations to the Activity Log"
```

---

### Task 3: Full suite verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All test files pass.

- [ ] **Step 2: Run the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run the linter**

Run: `npx eslint .`
Expected: No errors.

- [ ] **Step 4: Run the production build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Manual smoke check (note only)**

Not executable in this environment — flag to the user: this is the last phase. After migration `0013_audit_log.sql` is applied, exercise every module once (create/edit/delete a bill, a reminder, a card, an income source, a category; archive/unarchive/merge a category; upload/rename/link/delete a receipt) and confirm `/activity` shows a correct, complete trail with accurate before/after values and local timestamps. This closes out the entire Activity Log feature from the 2026-08-07 backlog request.
