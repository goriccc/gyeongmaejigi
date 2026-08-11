'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ko } from '@/messages/ko';
import { useCases } from '@/lib/hooks/useCases';
import { getCaseChapterProgress, getChapterProgress } from '@/lib/stage';

const ITEMS = [
  { href: '/', chapter: 'dashboard' as const, num: '설정', name: ko.rail.cover },
  { href: '/a', chapter: 'A' as const, num: '제1장', name: ko.rail.ch1 },
  { href: '/b', chapter: 'B' as const, num: '제2장', name: ko.rail.ch2 },
  { href: '/c', chapter: 'C' as const, num: '제3장', name: ko.rail.ch3 },
  { href: '/d', chapter: 'D' as const, num: '제4장', name: ko.rail.ch4 },
  { href: '/f', chapter: 'F' as const, num: '제5장', name: ko.rail.ch5 },
  { href: '/e', chapter: 'E' as const, num: '제6장', name: ko.rail.ch6 },
];

export function SideRail() {
  const pathname = usePathname();
  const { activeCase } = useCases();
  const stage = activeCase?.stage ?? 'A';

  return (
    <aside className="rail">
      <div className="rail-index">{ko.rail.index}</div>
      {ITEMS.map((item) => {
        const active =
          item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
        const progress =
          item.chapter === 'dashboard'
            ? null
            : activeCase
              ? getCaseChapterProgress(activeCase, item.chapter)
              : getChapterProgress(stage, item.chapter, 'bidding');

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rail-item${active ? ' active' : ''}${progress === '건너뜀' ? ' is-skipped' : ''}`}
          >
            <span className="r-num">{item.num}</span>
            <span className="r-name">{item.name}</span>
            {progress ? (
              <span
                className={`r-stage${progress === '건너뜀' ? ' muted' : ''}`}
              >
                {progress}
              </span>
            ) : null}
          </Link>
        );
      })}
    </aside>
  );
}
