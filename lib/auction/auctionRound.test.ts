import { describe, expect, it } from 'vitest';
import {
  formatAuctionRoundLabel,
  parseAuctionRound,
  toAuctionRound,
} from './auctionRound';

describe('auctionRound', () => {
  it('converts failed bid count to round', () => {
    expect(toAuctionRound(2)).toBe(3);
    expect(formatAuctionRoundLabel(3)).toBe('3회차');
  });

  it('parses round from schedule row', () => {
    expect(parseAuctionRound({ yuchalCnt: '2' })).toBe(3);
    expect(parseAuctionRound({ dspslDxdySeq: '4' })).toBe(4);
  });
});
