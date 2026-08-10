export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch/i.test(error.message);
}
