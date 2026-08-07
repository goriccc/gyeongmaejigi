import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '제2장 권리분석',
  description:
    '등기부등본·매각물건명세서·현황조사서 위험 요소를 대조 체크합니다.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
