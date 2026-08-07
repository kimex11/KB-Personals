export const budgetAmountsByCategoryName: Record<string, { limit: number; spent: number }> = {
  Housing: { limit: 1450, spent: 1450 },
  Groceries: { limit: 500, spent: 468 },
  Transport: { limit: 200, spent: 145 },
  Entertainment: { limit: 120, spent: 138 },
  Utilities: { limit: 220, spent: 190 },
  Shopping: { limit: 300, spent: 95 },
};

export const DEFAULT_BUDGET_AMOUNTS = { limit: 0, spent: 0 };
