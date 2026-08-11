import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '제5장 대출상품 비교',
  description: '낙찰 후 대출상담사 조건을 비교·정렬합니다.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
