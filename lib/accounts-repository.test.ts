import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listCreditCardDues,
  createCreditCardDue,
  updateCreditCardDue,
  deleteCreditCardDue,
  uploadCardImage,
  removeCardImage,
  listIncomeSources,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
} from './accounts-repository';

const selectOrderMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const updateEqMock = vi.fn();
const updateSelectSingleMock = vi.fn();
const updateMock = vi.fn(() => ({
  eq: (...args: unknown[]) => ({
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      updateEqMock(...args).then(resolve, reject),
    select: () => ({ single: updateSelectSingleMock }),
  }),
}));
const deleteEqMock = vi.fn();
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
const uploadStorageMock = vi.fn();
const removeStorageMock = vi.fn();
const getPublicUrlMock = vi.fn((path: string) => ({ data: { publicUrl: `https://storage.example/card-images/${path}` } }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'credit_card_dues' && table !== 'income_sources') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({ order: selectOrderMock }),
        insert: insertMock,
        update: updateMock,
        delete: deleteMock,
      };
    },
    storage: {
      from: () => ({
        getPublicUrl: getPublicUrlMock,
        upload: uploadStorageMock,
        remove: removeStorageMock,
      }),
    },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const cardRow = {
  id: 'card-1',
  card_name: 'Visa Platinum',
  last4: '4821',
  statement_balance: 842.5,
  minimum_payment: 45,
  due_date: '2026-08-16',
  balance_anchor_at: '2026-08-01T00:00:00.000Z',
  image_storage_path: null,
  created_at: '2026-08-15T10:00:00.000Z',
};

describe('listCreditCardDues', () => {
  it('returns cards ordered by due date', async () => {
    selectOrderMock.mockResolvedValue({ data: [cardRow], error: null });
    const result = await listCreditCardDues();
    expect(result).toEqual([
      {
        id: 'card-1',
        cardName: 'Visa Platinum',
        last4: '4821',
        statementBalance: 842.5,
        minimumPayment: 45,
        dueDate: '2026-08-16',
        balanceAnchorAt: '2026-08-01T00:00:00.000Z',
        imageUrl: null,
        imageStoragePath: null,
      },
    ]);
    expect(selectOrderMock).toHaveBeenCalledWith('due_date', { ascending: true });
  });

  it('throws on error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listCreditCardDues()).rejects.toThrow('boom');
  });
});

describe('createCreditCardDue', () => {
  it('inserts a new card row', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: cardRow, error: null });
    const result = await createCreditCardDue({
      cardName: 'Visa Platinum',
      last4: '4821',
      statementBalance: 842.5,
      minimumPayment: 45,
      dueDate: '2026-08-16',
    });
    expect(insertMock).toHaveBeenCalledWith({
      card_name: 'Visa Platinum',
      last4: '4821',
      statement_balance: 842.5,
      minimum_payment: 45,
      due_date: '2026-08-16',
    });
    expect(result).toEqual({
      id: 'card-1',
      cardName: 'Visa Platinum',
      last4: '4821',
      statementBalance: 842.5,
      minimumPayment: 45,
      dueDate: '2026-08-16',
      balanceAnchorAt: '2026-08-01T00:00:00.000Z',
      imageUrl: null,
      imageStoragePath: null,
    });
  });
});

describe('updateCreditCardDue', () => {
  it('updates only the provided fields', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateCreditCardDue('card-1', { minimumPayment: 60 });
    expect(updateMock).toHaveBeenCalledWith({ minimum_payment: 60 });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'card-1');
  });

  it('re-anchors the balance timestamp whenever the statement balance is changed', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateCreditCardDue('card-1', { statementBalance: 900 });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ statement_balance: 900, balance_anchor_at: expect.any(String) })
    );
  });

  it('throws on error', async () => {
    updateEqMock.mockResolvedValue({ error: new Error('boom') });
    await expect(updateCreditCardDue('card-1', { statementBalance: 900 })).rejects.toThrow('boom');
  });
});

describe('deleteCreditCardDue', () => {
  it('deletes the row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteCreditCardDue('card-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'card-1');
  });
});

describe('uploadCardImage', () => {
  it('uploads the file, stores its path, and returns the card with a public image URL', async () => {
    uploadStorageMock.mockResolvedValue({ error: null });
    updateSelectSingleMock.mockResolvedValue({ data: { ...cardRow, image_storage_path: 'card-1/123-visa.png' }, error: null });

    const file = new File(['fake'], 'visa.png', { type: 'image/png' });
    const result = await uploadCardImage('card-1', file);

    expect(uploadStorageMock).toHaveBeenCalledWith(expect.stringMatching(/^card-1\/\d+-visa\.png$/), file);
    expect(result.imageUrl).toBe('https://storage.example/card-images/card-1/123-visa.png');
  });

  it('throws when the storage upload fails, without updating the card', async () => {
    uploadStorageMock.mockResolvedValue({ error: new Error('upload failed') });
    const file = new File(['fake'], 'visa.png', { type: 'image/png' });
    await expect(uploadCardImage('card-1', file)).rejects.toThrow('upload failed');
    expect(updateSelectSingleMock).not.toHaveBeenCalled();
  });
});

describe('removeCardImage', () => {
  it('removes the stored file and clears the card image path', async () => {
    removeStorageMock.mockResolvedValue({ error: null });
    updateSelectSingleMock.mockResolvedValue({ data: cardRow, error: null });

    const result = await removeCardImage('card-1', 'card-1/123-visa.png');

    expect(removeStorageMock).toHaveBeenCalledWith(['card-1/123-visa.png']);
    expect(result.imageUrl).toBeNull();
  });

  it('clears the DB reference before deleting the file, so a failed file delete never leaves a dangling reference', async () => {
    const callOrder: string[] = [];
    updateSelectSingleMock.mockImplementation(async () => {
      callOrder.push('db-update');
      return { data: cardRow, error: null };
    });
    removeStorageMock.mockImplementation(async () => {
      callOrder.push('storage-remove');
      return { error: null };
    });

    await removeCardImage('card-1', 'card-1/123-visa.png');

    expect(callOrder).toEqual(['db-update', 'storage-remove']);
  });

  it('throws when clearing the DB reference fails, without attempting to delete the file', async () => {
    updateSelectSingleMock.mockResolvedValue({ data: null, error: new Error('update failed') });

    await expect(removeCardImage('card-1', 'card-1/123-visa.png')).rejects.toThrow('update failed');
    expect(removeStorageMock).not.toHaveBeenCalled();
  });
});

const incomeRow = {
  id: 'income-1',
  name: 'Salary',
  amount: 3200,
  date: '2026-08-20',
  created_at: '2026-08-15T10:00:00.000Z',
};

describe('listIncomeSources', () => {
  it('returns income sources ordered by date', async () => {
    selectOrderMock.mockResolvedValue({ data: [incomeRow], error: null });
    const result = await listIncomeSources();
    expect(result).toEqual([{ id: 'income-1', name: 'Salary', amount: 3200, date: '2026-08-20' }]);
    expect(selectOrderMock).toHaveBeenCalledWith('date', { ascending: true });
  });
});

describe('createIncomeSource', () => {
  it('inserts a new income row', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: incomeRow, error: null });
    const result = await createIncomeSource({ name: 'Salary', amount: 3200, date: '2026-08-20' });
    expect(insertMock).toHaveBeenCalledWith({ name: 'Salary', amount: 3200, date: '2026-08-20' });
    expect(result).toEqual({ id: 'income-1', name: 'Salary', amount: 3200, date: '2026-08-20' });
  });
});

describe('updateIncomeSource', () => {
  it('updates only the provided fields', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateIncomeSource('income-1', { amount: 3300 });
    expect(updateMock).toHaveBeenCalledWith({ amount: 3300 });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'income-1');
  });
});

describe('deleteIncomeSource', () => {
  it('deletes the row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteIncomeSource('income-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'income-1');
  });
});
