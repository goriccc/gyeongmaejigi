import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '제4장 입찰가 계산',
  description: '목표마진 기반 입찰가 역산과 비용·대출상품 비교 계산기.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
