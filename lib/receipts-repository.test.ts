import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  uploadReceipt,
  listReceipts,
  deleteReceipt,
  updateReceiptFields,
  linkReceiptToBill,
  renameReceipt,
  updateReceiptDescription,
} from './receipts-repository';

const mockUser = { id: 'user-1' };

function makeFile(name: string, type: string) {
  return new File(['content'], name, { type });
}

const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const selectOrderMock = vi.fn();
const selectEqMock = vi.fn(() => ({ order: selectOrderMock }));
const getUserMock = vi.fn();
const deleteUserEqMock = vi.fn();
const deleteEqMock = vi.fn(() => ({ eq: deleteUserEqMock }));
const updateUserEqMock = vi.fn();
const updateEqMock = vi.fn(() => ({ eq: updateUserEqMock }));
const updateMock = vi.fn(() => ({ eq: updateEqMock }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
        createSignedUrl: createSignedUrlMock,
      }),
    },
    from: (table: string) => {
      if (table !== 'receipts') throw new Error(`Unexpected table: ${table}`);
      return {
        insert: () => ({
          select: () => ({
            single: insertSelectSingleMock,
          }),
        }),
        select: () => ({
          eq: selectEqMock,
        }),
        delete: () => ({
          eq: deleteEqMock,
        }),
        update: updateMock,
      };
    },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('uploadReceipt', () => {
  it('uploads the file to storage under the user id, inserts a row, and returns a signed preview URL', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    uploadMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({
      data: {
        id: 'receipt-1',
        file_name: 'receipt.jpg',
        file_type: 'image/jpeg',
        file_size: 1000,
        storage_path: 'user-1/123-receipt.jpg',
        created_at: '2026-08-15T10:00:00.000Z',
        merchant: null,
        receipt_date: null,
        amount: null,
        linked_bill_id: null,
      },
      error: null,
    });
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/url' }, error: null });

    const result = await uploadReceipt(makeFile('receipt.jpg', 'image/jpeg'));

    expect(uploadMock).toHaveBeenCalled();
    const [storagePathArg] = uploadMock.mock.calls[0];
    expect(storagePathArg.startsWith('user-1/')).toBe(true);
    expect(result).toEqual({
      id: 'receipt-1',
      fileName: 'receipt.jpg',
      fileType: 'image/jpeg',
      fileSize: 1000,
      storagePath: 'user-1/123-receipt.jpg',
      previewUrl: 'https://signed.example/url',
      uploadedAt: '2026-08-15T10:00:00.000Z',
      merchant: null,
      receiptDate: null,
      amount: null,
      linkedBillId: null,
      description: null,
    });
  });

  it('throws when there is no authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(uploadReceipt(makeFile('receipt.jpg', 'image/jpeg'))).rejects.toThrow('Not authenticated');
  });
});

describe('listReceipts', () => {
  it('returns stored receipts with signed preview URLs, newest first', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    selectOrderMock.mockResolvedValue({
      data: [
        {
          id: 'receipt-1',
          file_name: 'a.jpg',
          file_type: 'image/jpeg',
          file_size: 500,
          storage_path: 'user-1/a.jpg',
          created_at: '2026-08-15T10:00:00.000Z',
          merchant: 'Whole Foods Market',
          receipt_date: '2026-08-15',
          amount: 42.18,
          linked_bill_id: 'bill-0',
        },
      ],
      error: null,
    });
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/a' }, error: null });

    const result = await listReceipts();

    expect(result).toEqual([
      {
        id: 'receipt-1',
        fileName: 'a.jpg',
        fileType: 'image/jpeg',
        fileSize: 500,
        storagePath: 'user-1/a.jpg',
        previewUrl: 'https://signed.example/a',
        uploadedAt: '2026-08-15T10:00:00.000Z',
        merchant: 'Whole Foods Market',
        receiptDate: '2026-08-15',
        amount: 42.18,
        linkedBillId: 'bill-0',
        description: null,
      },
    ]);
  });

  it('returns an empty array when there are no receipts', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    selectOrderMock.mockResolvedValue({ data: [], error: null });
    expect(await listReceipts()).toEqual([]);
  });

  it('scopes the query to the authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    selectOrderMock.mockResolvedValue({ data: [], error: null });
    await listReceipts();
    expect(selectEqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

describe('deleteReceipt', () => {
  it('removes the storage object and the row, scoped to the owning user', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    removeMock.mockResolvedValue({ error: null });
    deleteUserEqMock.mockResolvedValue({ error: null });

    await deleteReceipt('receipt-1', 'user-1/a.jpg');

    expect(removeMock).toHaveBeenCalledWith(['user-1/a.jpg']);
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'receipt-1');
    expect(deleteUserEqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws when there is no authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(deleteReceipt('receipt-1', 'user-1/a.jpg')).rejects.toThrow('Not authenticated');
  });

  it('throws when the row delete fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    removeMock.mockResolvedValue({ error: null });
    deleteUserEqMock.mockResolvedValue({ error: new Error('db down') });
    await expect(deleteReceipt('receipt-1', 'user-1/a.jpg')).rejects.toThrow('db down');
  });
});

describe('updateReceiptFields', () => {
  it('updates the merchant, date, and amount columns for the given receipt id, scoped to the owning user', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: null });

    await updateReceiptFields('receipt-1', {
      merchant: 'Whole Foods Market',
      date: '2026-08-15',
      amount: 42.18,
      rawText: 'irrelevant',
    });

    expect(updateMock).toHaveBeenCalledWith({
      merchant: 'Whole Foods Market',
      receipt_date: '2026-08-15',
      amount: 42.18,
    });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'receipt-1');
    expect(updateUserEqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws when there is no authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(
      updateReceiptFields('receipt-1', { merchant: 'X', date: '2026-08-15', amount: 1, rawText: '' })
    ).rejects.toThrow('Not authenticated');
  });

  it('throws when the update fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: new Error('db down') });
    await expect(
      updateReceiptFields('receipt-1', { merchant: 'X', date: '2026-08-15', amount: 1, rawText: '' })
    ).rejects.toThrow('db down');
  });
});

describe('linkReceiptToBill', () => {
  it('sets linked_bill_id to the given bill id, scoped to the owning user', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: null });
    await linkReceiptToBill('receipt-1', 'bill-0');
    expect(updateMock).toHaveBeenCalledWith({ linked_bill_id: 'bill-0' });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'receipt-1');
    expect(updateUserEqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('sets linked_bill_id to null to unlink', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: null });
    await linkReceiptToBill('receipt-1', null);
    expect(updateMock).toHaveBeenCalledWith({ linked_bill_id: null });
  });

  it('throws when there is no authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(linkReceiptToBill('receipt-1', 'bill-0')).rejects.toThrow('Not authenticated');
  });

  it('throws when the update fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: new Error('db down') });
    await expect(linkReceiptToBill('receipt-1', 'bill-0')).rejects.toThrow('db down');
  });
});

describe('renameReceipt', () => {
  it('updates the file name, scoped to the owning user', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: null });
    await renameReceipt('receipt-1', 'grocery-run.jpg');
    expect(updateMock).toHaveBeenCalledWith({ file_name: 'grocery-run.jpg' });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'receipt-1');
    expect(updateUserEqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws when there is no authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(renameReceipt('receipt-1', 'grocery-run.jpg')).rejects.toThrow('Not authenticated');
  });

  it('throws when the update fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: new Error('db down') });
    await expect(renameReceipt('receipt-1', 'grocery-run.jpg')).rejects.toThrow('db down');
  });
});

describe('updateReceiptDescription', () => {
  it('updates the description, scoped to the owning user', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: null });
    await updateReceiptDescription('receipt-1', 'Weekly grocery run');
    expect(updateMock).toHaveBeenCalledWith({ description: 'Weekly grocery run' });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'receipt-1');
    expect(updateUserEqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('clears the description when given null', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: null });
    await updateReceiptDescription('receipt-1', null);
    expect(updateMock).toHaveBeenCalledWith({ description: null });
  });

  it('throws when there is no authenticated user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(updateReceiptDescription('receipt-1', 'text')).rejects.toThrow('Not authenticated');
  });

  it('throws when the update fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: mockUser } });
    updateUserEqMock.mockResolvedValue({ error: new Error('db down') });
    await expect(updateReceiptDescription('receipt-1', 'text')).rejects.toThrow('db down');
  });
});
