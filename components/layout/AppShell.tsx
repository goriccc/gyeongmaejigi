'use client';

import type { ReactNode } from 'react';
import { CasesProvider } from '@/lib/hooks/useCases';
import { TopNav } from '@/components/nav/TopNav';
import { SideRail } from '@/components/nav/SideRail';
import { BottomNav } from '@/components/nav/BottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CasesProvider>
      <TopNav />
      <div className="shell">
        <SideRail />
        <main className="content">
          <div className="view">{children}</div>
        </main>
      </div>
      <BottomNav />
    </CasesProvider>
  );
}
