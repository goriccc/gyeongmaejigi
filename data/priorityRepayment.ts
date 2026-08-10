/**
 * 소액임차인 최우선변제 기준표
 * 출처: 주택임대차보호법 시행령 기준 최신표 (최선순위담보물권 설정일·전입일 등 기준시점)
 * 금액 단위: 만원
 */

export type PriorityRepaymentRow = {
  /** 기준기간 표시 */
  period: string;
  periodFrom: string;
  /** null = 현재 */
  periodTo: string | null;
  region: string;
  /** 보증금 범위 상한(만원, 이하) */
  depositMaxMan: number;
  /** 최우선변제 한도(만원, 까지) */
  priorityMaxMan: number;
};

export const PRIORITY_REPAYMENT_AS_OF = '2023.02.21~현재';

export const PRIORITY_REPAYMENT_ROWS: PriorityRepaymentRow[] = [
  // 1984.06.14 ~ 1987.11.30
  {
    period: '1984.06.14 ~ 1987.11.30',
    periodFrom: '1984-06-14',
    periodTo: '1987-11-30',
    region: '특별시·직할시',
    depositMaxMan: 300,
    priorityMaxMan: 300,
  },
  {
    period: '1984.06.14 ~ 1987.11.30',
    periodFrom: '1984-06-14',
    periodTo: '1987-11-30',
    region: '기타지역',
    depositMaxMan: 200,
    priorityMaxMan: 200,
  },
  // 1987.12.01 ~ 1990.02.18
  {
    period: '1987.12.01 ~ 1990.02.18',
    periodFrom: '1987-12-01',
    periodTo: '1990-02-18',
    region: '특별시·직할시',
    depositMaxMan: 500,
    priorityMaxMan: 500,
  },
  {
    period: '1987.12.01 ~ 1990.02.18',
    periodFrom: '1987-12-01',
    periodTo: '1990-02-18',
    region: '기타지역',
    depositMaxMan: 400,
    priorityMaxMan: 400,
  },
  // 1990.02.19 ~ 1995.10.18
  {
    period: '1990.02.19 ~ 1995.10.18',
    periodFrom: '1990-02-19',
    periodTo: '1995-10-18',
    region: '특별시·직할시',
    depositMaxMan: 2_000,
    priorityMaxMan: 700,
  },
  {
    period: '1990.02.19 ~ 1995.10.18',
    periodFrom: '1990-02-19',
    periodTo: '1995-10-18',
    region: '기타지역',
    depositMaxMan: 1_500,
    priorityMaxMan: 500,
  },
  // 1995.10.19 ~ 2001.09.14
  {
    period: '1995.10.19 ~ 2001.09.14',
    periodFrom: '1995-10-19',
    periodTo: '2001-09-14',
    region: '특별시·광역시 (군지역 제외)',
    depositMaxMan: 3_000,
    priorityMaxMan: 1_200,
  },
  {
    period: '1995.10.19 ~ 2001.09.14',
    periodFrom: '1995-10-19',
    periodTo: '2001-09-14',
    region: '기타지역',
    depositMaxMan: 2_000,
    priorityMaxMan: 800,
  },
  // 2001.09.15 ~ 2008.08.20
  {
    period: '2001.09.15 ~ 2008.08.20',
    periodFrom: '2001-09-15',
    periodTo: '2008-08-20',
    region: '수도권정비계획법 중 과밀억제권역',
    depositMaxMan: 4_000,
    priorityMaxMan: 1_600,
  },
  {
    period: '2001.09.15 ~ 2008.08.20',
    periodFrom: '2001-09-15',
    periodTo: '2008-08-20',
    region: '광역시(군지역과 인천광역시 지역 제외)',
    depositMaxMan: 3_500,
    priorityMaxMan: 1_400,
  },
  {
    period: '2001.09.15 ~ 2008.08.20',
    periodFrom: '2001-09-15',
    periodTo: '2008-08-20',
    region: '그 밖의 지역',
    depositMaxMan: 3_000,
    priorityMaxMan: 1_200,
  },
  // 2008.08.21 ~ 2010.07.25
  {
    period: '2008.08.21 ~ 2010.07.25',
    periodFrom: '2008-08-21',
    periodTo: '2010-07-25',
    region: '수도권정비계획법 중 과밀억제권역',
    depositMaxMan: 6_000,
    priorityMaxMan: 2_000,
  },
  {
    period: '2008.08.21 ~ 2010.07.25',
    periodFrom: '2008-08-21',
    periodTo: '2010-07-25',
    region: '광역시(군지역과 인천광역시 지역 제외)',
    depositMaxMan: 5_000,
    priorityMaxMan: 1_700,
  },
  {
    period: '2008.08.21 ~ 2010.07.25',
    periodFrom: '2008-08-21',
    periodTo: '2010-07-25',
    region: '그 밖의 지역',
    depositMaxMan: 4_000,
    priorityMaxMan: 1_400,
  },
  // 2010.07.26 ~ 2013.12.31
  {
    period: '2010.07.26 ~ 2013.12.31',
    periodFrom: '2010-07-26',
    periodTo: '2013-12-31',
    region: '서울특별시',
    depositMaxMan: 7_500,
    priorityMaxMan: 2_500,
  },
  {
    period: '2010.07.26 ~ 2013.12.31',
    periodFrom: '2010-07-26',
    periodTo: '2013-12-31',
    region: '수도권정비계획법에 따른 과밀억제권역 (서울특별시 제외)',
    depositMaxMan: 6_500,
    priorityMaxMan: 2_200,
  },
  {
    period: '2010.07.26 ~ 2013.12.31',
    periodFrom: '2010-07-26',
    periodTo: '2013-12-31',
    region:
      '광역시(수도권정비계획법에 따른 과밀억제권역에 포함된 지역과 군지역은 제외), 안산시, 용인시, 김포시, 광주시',
    depositMaxMan: 5_500,
    priorityMaxMan: 1_900,
  },
  {
    period: '2010.07.26 ~ 2013.12.31',
    periodFrom: '2010-07-26',
    periodTo: '2013-12-31',
    region: '그 밖의 지역',
    depositMaxMan: 4_000,
    priorityMaxMan: 1_400,
  },
  // 2014.01.01 ~ 2016.03.30
  {
    period: '2014.01.01 ~ 2016.03.30',
    periodFrom: '2014-01-01',
    periodTo: '2016-03-30',
    region: '서울특별시',
    depositMaxMan: 9_500,
    priorityMaxMan: 3_200,
  },
  {
    period: '2014.01.01 ~ 2016.03.30',
    periodFrom: '2014-01-01',
    periodTo: '2016-03-30',
    region: '수도권정비계획법에 따른 과밀억제권역 (서울특별시 제외)',
    depositMaxMan: 8_000,
    priorityMaxMan: 2_700,
  },
  {
    period: '2014.01.01 ~ 2016.03.30',
    periodFrom: '2014-01-01',
    periodTo: '2016-03-30',
    region:
      '광역시(수도권정비계획법에 따른 과밀억제권역에 포함된 지역과 군지역은 제외), 안산시, 용인시, 김포시, 광주시',
    depositMaxMan: 6_000,
    priorityMaxMan: 2_000,
  },
  {
    period: '2014.01.01 ~ 2016.03.30',
    periodFrom: '2014-01-01',
    periodTo: '2016-03-30',
    region: '그 밖의 지역',
    depositMaxMan: 4_500,
    priorityMaxMan: 1_500,
  },
  // 2016.03.31 ~ 2018.09.17
  {
    period: '2016.03.31 ~ 2018.09.17',
    periodFrom: '2016-03-31',
    periodTo: '2018-09-17',
    region: '서울특별시',
    depositMaxMan: 10_000,
    priorityMaxMan: 3_400,
  },
  {
    period: '2016.03.31 ~ 2018.09.17',
    periodFrom: '2016-03-31',
    periodTo: '2018-09-17',
    region: '수도권정비계획법에 따른 과밀억제권역 (서울특별시 제외)',
    depositMaxMan: 8_000,
    priorityMaxMan: 2_700,
  },
  {
    period: '2016.03.31 ~ 2018.09.17',
    periodFrom: '2016-03-31',
    periodTo: '2018-09-17',
    region:
      '광역시(수도권정비계획법에 따른 과밀억제권역에 포함된 지역과 군지역은 제외), 세종특별자치시, 안산시, 용인시, 김포시, 광주시',
    depositMaxMan: 6_000,
    priorityMaxMan: 2_000,
  },
  {
    period: '2016.03.31 ~ 2018.09.17',
    periodFrom: '2016-03-31',
    periodTo: '2018-09-17',
    region: '그 밖의 지역',
    depositMaxMan: 5_000,
    priorityMaxMan: 1_700,
  },
  // 2018.09.18 ~ 2021.05.10
  {
    period: '2018.09.18 ~ 2021.05.10',
    periodFrom: '2018-09-18',
    periodTo: '2021-05-10',
    region: '서울특별시',
    depositMaxMan: 11_000,
    priorityMaxMan: 3_700,
  },
  {
    period: '2018.09.18 ~ 2021.05.10',
    periodFrom: '2018-09-18',
    periodTo: '2021-05-10',
    region:
      '수도권정비계획법에 따른 과밀억제권역(서울특별시는 제외), 세종특별자치시, 용인시, 화성시',
    depositMaxMan: 10_000,
    priorityMaxMan: 3_400,
  },
  {
    period: '2018.09.18 ~ 2021.05.10',
    periodFrom: '2018-09-18',
    periodTo: '2021-05-10',
    region:
      '광역시(수도권정비계획법에 따른 과밀억제권역에 포함된 지역과 군지역은 제외), 안산시, 김포시, 광주시, 파주시',
    depositMaxMan: 6_000,
    priorityMaxMan: 2_000,
  },
  {
    period: '2018.09.18 ~ 2021.05.10',
    periodFrom: '2018-09-18',
    periodTo: '2021-05-10',
    region: '그 밖의 지역',
    depositMaxMan: 5_000,
    priorityMaxMan: 1_700,
  },
  // 2021.05.11 ~ 2023.02.20
  {
    period: '2021.05.11 ~ 2023.02.20',
    periodFrom: '2021-05-11',
    periodTo: '2023-02-20',
    region: '서울특별시',
    depositMaxMan: 15_000,
    priorityMaxMan: 5_000,
  },
  {
    period: '2021.05.11 ~ 2023.02.20',
    periodFrom: '2021-05-11',
    periodTo: '2023-02-20',
    region:
      '수도권정비계획법에 따른 과밀억제권역(서울특별시는 제외), 세종특별자치시, 용인시, 화성시, 김포시',
    depositMaxMan: 13_000,
    priorityMaxMan: 4_300,
  },
  {
    period: '2021.05.11 ~ 2023.02.20',
    periodFrom: '2021-05-11',
    periodTo: '2023-02-20',
    region:
      '광역시(수도권정비계획법에 따른 과밀억제권역에 포함된 지역과 군지역은 제외), 안산시, 광주시, 파주시, 이천시, 평택시',
    depositMaxMan: 7_000,
    priorityMaxMan: 2_300,
  },
  {
    period: '2021.05.11 ~ 2023.02.20',
    periodFrom: '2021-05-11',
    periodTo: '2023-02-20',
    region: '그 밖의 지역',
    depositMaxMan: 6_000,
    priorityMaxMan: 2_000,
  },
  // 2023.02.21 ~ 현재
  {
    period: '2023.02.21 ~ 현재',
    periodFrom: '2023-02-21',
    periodTo: null,
    region: '서울특별시',
    depositMaxMan: 16_500,
    priorityMaxMan: 5_500,
  },
  {
    period: '2023.02.21 ~ 현재',
    periodFrom: '2023-02-21',
    periodTo: null,
    region:
      '수도권정비계획법에 따른 과밀억제권역(서울특별시는 제외), 세종특별자치시, 용인시, 화성시, 김포시',
    depositMaxMan: 14_500,
    priorityMaxMan: 4_800,
  },
  {
    period: '2023.02.21 ~ 현재',
    periodFrom: '2023-02-21',
    periodTo: null,
    region:
      '광역시(수도권정비계획법에 따른 과밀억제권역에 포함된 지역과 군지역은 제외), 안산시, 광주시, 파주시, 이천시, 평택시',
    depositMaxMan: 8_500,
    priorityMaxMan: 2_800,
  },
  {
    period: '2023.02.21 ~ 현재',
    periodFrom: '2023-02-21',
    periodTo: null,
    region: '그 밖의 지역',
    depositMaxMan: 7_500,
    priorityMaxMan: 2_500,
  },
];

function formatMan(n: number): string {
  if (n >= 10_000) {
    const eok = Math.floor(n / 10_000);
    const rest = n % 10_000;
    if (rest === 0) return `${eok}억원`;
    if (rest % 1_000 === 0) return `${eok}억${rest / 1_000}천만원`;
    return `${eok}억${rest.toLocaleString('ko-KR')}만원`;
  }
  return `${n.toLocaleString('ko-KR')}만원`;
}

/** LLM 프롬프트용 마크다운 표 */
export function priorityRepaymentTableMarkdown(): string {
  const header =
    '| 기준시점(최선순위담보물권 설정일 등) | 지역 | 보증금 범위 | 최우선변제 |\n|---|---|---|---|';
  const body = PRIORITY_REPAYMENT_ROWS.map(
    (r) =>
      `| ${r.period} | ${r.region} | ${formatMan(r.depositMaxMan)} 이하 | ${formatMan(r.priorityMaxMan)} 까지 |`,
  ).join('\n');
  return `${header}\n${body}`;
}

/** 사용자 권리분석에 최우선변제 관련 언급이 있는지 */
export function userMentionsPriorityRepayment(judgment: string): boolean {
  const t = judgment.replace(/\s+/g, '');
  return /최우선변제|소액임차|우선변제금|주임법.*제?8|주택임대차보호법.*제?8/.test(
    t,
  );
}
