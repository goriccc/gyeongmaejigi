'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ko } from '@/messages/ko';
import { useCases } from '@/lib/hooks/useCases';
import { SealMark } from './SealMark';

const LINKS = [
  { href: '/', target: 'dashboard', label: ko.nav.dashboard },
  { href: '/a', target: 'a', label: ko.nav.a },
  { href: '/b', target: 'b', label: ko.nav.b },
  { href: '/c', target: 'c', label: ko.nav.c },
  { href: '/d', target: 'd', label: ko.nav.d },
  { href: '/e', target: 'e', label: ko.nav.e },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();
  const { cases } = useCases();
  const activeCount = cases.filter((c) => c.stage !== 'done').length;

  return (
    <header className="topnav">
      <Link href="/" className="brand">
        <SealMark />
        <span className="brand-name">{ko.brand}</span>
        <span className="brand-tag">{ko.tagline}</span>
      </Link>
      <nav className="topnav-links" aria-label="주 메뉴">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`tn-link${isActive(pathname, link.href) ? ' active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <span className="tn-status">{ko.common.activeCount(activeCount)}</span>
    </header>
  );
}
