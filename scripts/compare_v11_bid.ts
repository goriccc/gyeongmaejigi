/** Compare site convergeBid with V11 Excel defaults (580M sell, 16% margin). */
import { convergeBid } from '../lib/calc/bidConverge';

const sellPrice = 580_000_000;
const margin = 0.16;
const costRate = 0.05;
const months = 6;
const loanRate = 0.05;

const excelBond = 882_940;
const excelMiscOther = 300_000;

function run(label: string, extra: Parameters<typeof convergeBid>[0]) {
  const r = convergeBid(extra);
  const items = Object.fromEntries(r.costs.items.map((i) => [i.key, i.amount]));
  console.log(`\n=== ${label} ===`);
  console.log('bidPrice', Math.round(r.bidPrice));
  console.log('costAmt (required for bid)', Math.round(r.costAmt));
  console.log('conditionalExtra param', extra.conditionalExtra);
  console.log('requiredTotal', Math.round(r.costs.requiredTotal));
  console.log('conditionalTotal', Math.round(r.costs.conditionalTotal));
  console.log('detailedTotal', Math.round(r.costs.detailedTotal));
  console.log('approxTotal', Math.round(r.costs.approxTotal));
  console.log('diff (approx-detailed)', Math.round(r.costs.diff));
  console.log('items:', items);
  return r;
}

// Excel-like: standard, no VAT, bond 882940, misc 300k, farm in excel is separate (X row)
const base = run('Site standard (bond default 1.5M)', {
  sellPrice,
  months,
  loanRate,
  margin,
  costRate,
  conditionalExtra: excelMiscOther,
  buildingVat: 0,
  propertySize: 'standard',
  conditionalWon: { miscOther: excelMiscOther },
});

run('Site with Excel bond 882940', {
  sellPrice,
  months,
  loanRate,
  margin,
  costRate,
  conditionalExtra: excelMiscOther,
  buildingVat: 0,
  propertySize: 'standard',
  conditionalWon: { miscOther: excelMiscOther },
  housingBond: { customerBurden: excelBond, note: 'excel' },
});

run('Site large + farm (86m2)', {
  sellPrice,
  months,
  loanRate,
  margin,
  costRate,
  conditionalExtra: excelMiscOther,
  buildingVat: 0,
  propertySize: 'large',
  exclusiveAreaM2: 86,
  conditionalWon: { miscOther: excelMiscOther },
  housingBond: { customerBurden: excelBond, note: 'excel' },
});

// Excel 1차 formula: sell - margin - approx
const e6 = sellPrice - sellPrice * margin - sellPrice * costRate;
console.log('\nExcel E6 (1차)', e6);
console.log('Excel E30 (50% diff)', 4_514_557.83);
console.log('Excel E31', e6 + 4_514_557.83);

// Site-style full detailed without conditional in bid formula
const full = run('V11 excel blend', {
  sellPrice: 580_000_000,
  months: 6,
  loanRate: 0.05,
  margin: 0.16,
  costRate: 0.05,
  conditionalExtra: 300_000,
  buildingVat: 0,
  propertySize: 'large',
  exclusiveAreaM2: 86,
  propertySizeMode: 'auto',
  conditionalWon: { miscOther: 300_000 },
  housingBond: { customerBurden: 882_940, note: 'excel' },
});

console.log('\nDelta vs Excel E31:', Math.round(full.bidPrice - 462_714_558));
console.log('Excel E29', 19970884.34);
console.log('Site detailed', Math.round(full.costs.detailedTotal));
