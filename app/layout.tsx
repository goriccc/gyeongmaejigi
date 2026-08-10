import type { Metadata } from 'next';
import { IBM_Plex_Mono, Noto_Serif_KR } from 'next/font/google';
import localFont from 'next/font/local';
import { AppShell } from '@/components/layout/AppShell';
import './globals.css';

const pretendard = localFont({
  src: [
    {
      path: '../fonts/pretendard/Pretendard-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/pretendard/Pretendard-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/pretendard/Pretendard-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/pretendard/Pretendard-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
});

const notoSerif = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

/** 커스텀 도메인 DNS가 없으면 vercel.app로 OG 절대 URL이 깨집니다. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://gyeongmaejigi.vercel.app');

const ogImage = {
  url: '/og.png',
  width: 1200,
  height: 678,
  alt: '경매지기 — 입찰 전, 한 번 더 확인하세요',
  type: 'image/png',
} as const;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: '경매지기 — 입찰 전, 한 번 더 확인하세요',
    template: '%s · 경매지기',
  },
  description:
    '시드머니 확인부터 권리분석 셀프체크, 임장, 입찰가 역산, 명도 코칭까지. 경매 한 건의 전 과정을 잇는 이중확인 포털.',
  openGraph: {
    title: '경매지기 — 입찰 전, 한 번 더 확인하세요',
    description:
      '판단은 본인 몫, 놓친 부분은 짚어드립니다. 경매 전 과정 이중확인 도구.',
    url: siteUrl,
    siteName: '경매지기',
    locale: 'ko_KR',
    type: 'website',
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: '경매지기 — 입찰 전, 한 번 더 확인하세요',
    description:
      '판단은 본인 몫, 놓친 부분은 짚어드립니다. 경매 전 과정 이중확인 도구.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${pretendard.variable} ${notoSerif.variable} ${plexMono.variable}`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
