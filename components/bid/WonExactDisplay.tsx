import { formatComma } from '@/lib/format';

type WonExactAmtProps = {
  amount: number;
  minus?: boolean;
};

/** 원 단위 금액 — 숫자·「원」만 볼드 */
export function WonExactAmt({ amount, minus }: WonExactAmtProps) {
  const sign = minus ? '−' : '';
  return (
    <span className="won-exact-amt">
      {sign}
      {formatComma(amount)}원
    </span>
  );
}

type WonExactLeadProps = {
  meta: string;
  amount: number;
  minus?: boolean;
};

/** (비율·범례) + 볼드 원화 금액 */
export function WonExactLeadDisplay({ meta, amount, minus }: WonExactLeadProps) {
  return (
    <>
      ({meta}) <WonExactAmt amount={amount} minus={minus} />
    </>
  );
}
