// No real budgets backend exists yet (no `budgets` table -- limits/spend
// aren't derived from actual bills/receipts). Every category falls back to
// DEFAULT_BUDGET_AMOUNTS until that's built; this map intentionally holds
// no per-category demo numbers.
export const budgetAmountsByCategoryName: Record<string, { limit: number; spent: number }> = {};

export const DEFAULT_BUDGET_AMOUNTS = { limit: 0, spent: 0 };
