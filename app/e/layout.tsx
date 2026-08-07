import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '제5장 명도 코칭',
  description: '점유자 대화 기반 회신 초안과 명도 협상 방향 안내.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
