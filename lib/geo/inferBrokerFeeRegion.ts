import {
  BROKER_FEE_REGIONS,
  type BrokerFeeRegionId,
  type BrokerFeeRegionProfile,
} from '@/data/brokerFeeRegions';

export type BrokerFeeRegionInput = {
  address?: string | null;
  courtName?: string | null;
};

type PrefixEntry = {
  prefix: string;
  region: BrokerFeeRegionProfile;
};

/** 긴 접두사 우선 매칭용 flat 목록 */
const ADDRESS_PREFIXES: PrefixEntry[] = BROKER_FEE_REGIONS.flatMap((region) =>
  region.addressPrefixes.map((prefix) => ({ prefix, region })),
).sort((a, b) => b.prefix.length - a.prefix.length);

function matchAddress(address: string): BrokerFeeRegionProfile | null {
  const trimmed = address.trim();
  if (!trimmed) return null;
  for (const { prefix, region } of ADDRESS_PREFIXES) {
    if (trimmed.startsWith(prefix)) return region;
  }
  return null;
}

function matchCourt(courtName: string): BrokerFeeRegionProfile | null {
  const trimmed = courtName.trim();
  if (!trimmed) return null;

  for (const region of BROKER_FEE_REGIONS) {
    if (region.courtKeywords.some((kw) => trimmed.includes(kw))) {
      return region;
    }
  }

  for (const region of BROKER_FEE_REGIONS) {
    if (trimmed.includes(region.shortName)) return region;
  }

  return null;
}

export type InferredBrokerFeeRegion = {
  regionId: BrokerFeeRegionId | null;
  profile: BrokerFeeRegionProfile;
  /** address | court | fallback */
  source: 'address' | 'court' | 'fallback';
};

/**
 * 사건 소재지·관할법원으로 중개보수 조례 시·도를 추정합니다.
 * @param input - address, courtName
 */
export function inferBrokerFeeRegion(
  input: BrokerFeeRegionInput,
): InferredBrokerFeeRegion {
  const fromAddress = input.address ? matchAddress(input.address) : null;
  if (fromAddress) {
    return {
      regionId: fromAddress.id,
      profile: fromAddress,
      source: 'address',
    };
  }

  const fromCourt = input.courtName ? matchCourt(input.courtName) : null;
  if (fromCourt) {
    return {
      regionId: fromCourt.id,
      profile: fromCourt,
      source: 'court',
    };
  }

  return {
    regionId: null,
    profile: {
      id: 'seoul',
      shortName: '전국',
      fullName: '전국 표준',
      ordinance: '공인중개사법 시행규칙 별표1 (시·도 조례 공통)',
      addressPrefixes: [],
      courtKeywords: [],
    },
    source: 'fallback',
  };
}
