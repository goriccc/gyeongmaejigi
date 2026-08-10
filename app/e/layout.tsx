import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '제5장 명도 코칭',
  description:
    '점유자 심리 분석과 회신 초안을 AI 명도코칭으로 제안합니다.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
