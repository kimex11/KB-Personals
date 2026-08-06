import type { ReactNode } from 'react';
import { Header } from './Header';
import { TabBar } from './TabBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main data-testid="app-shell-main">{children}</main>
      <TabBar />
    </>
  );
}
