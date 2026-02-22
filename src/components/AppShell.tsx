import type { ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Header />
      <Sidebar />
      <main className="site-main">{children}</main>
    </div>
  );
}
