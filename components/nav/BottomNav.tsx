'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ko } from '@/messages/ko';

const TABS = [
  { href: '/', label: ko.nav.dashboard },
  { href: '/a', label: '제1장' },
  { href: '/b', label: '제2장' },
  { href: '/c', label: '제3장' },
  { href: '/d', label: '제4장' },
  { href: '/f', label: '제5장' },
  { href: '/e', label: '제6장' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottomnav" id="bottomnav" aria-label="모바일 메뉴">
      {TABS.map((tab) => {
        const active =
          tab.href === '/'
            ? pathname === '/'
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`bn-btn${active ? ' active' : ''}`}
          >
            <span className="bn-dot" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
