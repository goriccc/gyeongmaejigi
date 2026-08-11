import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '제1장 · 입찰사건',
  description:
    '입찰 준비 사건을 등록·관리하고, 권리분석·임장·입찰가 계산·명도까지 한 건의 흐름으로 이어갑니다.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
