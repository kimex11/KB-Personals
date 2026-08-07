import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadReceipt, listReceipts, deleteReceipt } from './receipts-repository';

const mockUser = { id: 'user-1' };

function makeFile(name: string, type: string) {
  return new File(['content'], name, { type });
}

const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const deleteEqMock = vi.fn();
const selectOrderMock = vi.fn();
const getUserMock = vi.fn();

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
          order: selectOrderMock,
        }),
        delete: () => ({
          eq: deleteEqMock,
        }),
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
      },
    ]);
  });

  it('returns an empty array when there are no receipts', async () => {
    selectOrderMock.mockResolvedValue({ data: [], error: null });
    expect(await listReceipts()).toEqual([]);
  });
});

describe('deleteReceipt', () => {
  it('removes the storage object and the row', async () => {
    removeMock.mockResolvedValue({ error: null });
    deleteEqMock.mockResolvedValue({ error: null });

    await deleteReceipt('receipt-1', 'user-1/a.jpg');

    expect(removeMock).toHaveBeenCalledWith(['user-1/a.jpg']);
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'receipt-1');
  });
});
