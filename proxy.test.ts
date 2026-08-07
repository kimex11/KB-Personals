import { describe, expect, it, vi } from 'vitest';
import { PROTECTED_PATHS } from './proxy';
import { TAB_ITEMS } from './components/shell/tab-config';

describe('PROTECTED_PATHS', () => {
  it('includes every tab route, so a new tab can never ship unauthenticated by omission', () => {
    for (const tab of TAB_ITEMS) {
      expect(PROTECTED_PATHS).toContain(tab.href);
    }
  });
});

const getUserMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: getUserMock } }),
}));

describe('proxy', () => {
  it('redirects an unauthenticated request to a nested route under a protected path', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { proxy } = await import('./proxy');
    const request = new Request('http://localhost:3000/budget/categories') as unknown as import('next/server').NextRequest;
    Object.defineProperty(request, 'nextUrl', { value: new URL('http://localhost:3000/budget/categories') });
    Object.defineProperty(request, 'cookies', { value: { getAll: () => [], set: () => {} } });

    const result = await proxy(request);

    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('allows an authenticated request to a nested route under a protected path', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const { proxy } = await import('./proxy');
    const request = new Request('http://localhost:3000/budget/categories') as unknown as import('next/server').NextRequest;
    Object.defineProperty(request, 'nextUrl', { value: new URL('http://localhost:3000/budget/categories') });
    Object.defineProperty(request, 'cookies', { value: { getAll: () => [], set: () => {} } });

    const result = await proxy(request);

    expect(result.status).toBe(200);
  });
});
