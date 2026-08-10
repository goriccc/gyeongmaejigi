# 경매지기 (gyeongmaejigi)

시드머니 확인부터 권리분석 셀프체크, 임장, 입찰가 역산, 명도 코칭까지 — 경매 한 건의 전 과정을 잇는 포털입니다.

## 기술 스택

- Next.js 15 (App Router) + TypeScript
- 순수 CSS (디자인 토큰 / CSS 변수) — Tailwind 미사용
- localStorage 기반 사건 저장 (`CaseStore` 인터페이스 분리)
- Vitest 단위테스트 (`lib/calc/*`)

## 시작하기

```bash
pnpm install
pnpm dev
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm test` | 계산 로직 단위테스트 |
| `pnpm lint` | ESLint |

## 모듈

- `/` 사건철 대시보드
- `/a` 제1장 진입 매칭
- `/b` 제2장 권리분석
- `/c` 제3장 임장 준비
- `/d` 제4장 입찰가 계산
- `/e` 제5장 명도 코칭

개발용 시드 데이터는 `scripts/seedCases.ts`를 참고하세요. 앱 최초 실행에는 자동 주입되지 않습니다.

## 권리분석 LLM (제2장)

권리분석·명도코칭·내용증명은 Anthropic Claude API를 사용합니다.

```bash
cp .env.example .env.local
# ANTHROPIC_API_KEY 입력
```

Vercel 배포 시에도 동일 환경변수를 설정하세요. 원본 문서·대화는 저장하지 않습니다.
