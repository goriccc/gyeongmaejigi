import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '제1장 진입 매칭',
  description:
    '시드머니·주택수·연소득으로 LTV·DSR을 반영한 실투자 가능 낙찰가를 역산합니다.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
