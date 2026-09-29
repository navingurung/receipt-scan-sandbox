import type { ReceiptItem, TaxType } from "./receipt-mapper";

export type TaxBreakdown = {
  rate: number;
  // 税込レシートは税込額、税抜レシートは税抜額
  taxableAmount: number;
  taxAmount: number;
};

export type ReceiptTotals = {
  itemsTotal: number;
  discount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  breakdown: TaxBreakdown[];
};

export const TAX_RATES = [10, 8] as const;

export function getLineTotal(item: ReceiptItem): number {
  return item.unitPrice * item.quantity;
}

// 値引額を明細金額の比率で按分。端数は金額の大きい明細から 1 円ずつ配分し、合計を一致させる
export function allocateDiscount(items: ReceiptItem[], discount: number): number[] {
  const lineTotals = items.map(getLineTotal);
  const sum = lineTotals.reduce((acc, value) => acc + value, 0);
  if (discount <= 0 || sum <= 0) return lineTotals;

  const applied = Math.min(Math.floor(discount), sum);
  const shares = lineTotals.map((value) => Math.floor((applied * value) / sum));
  let remainder = applied - shares.reduce((acc, value) => acc + value, 0);

  const largestFirst = lineTotals
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value);
  for (const { value, index } of largestFirst) {
    if (remainder === 0) break;
    if (shares[index] < value) {
      shares[index] += 1;
      remainder -= 1;
    }
  }

  return lineTotals.map((value, index) => value - shares[index]);
}

// 消費税は税率ごとに 1 回、1 円未満切り捨て
function calculateTax(amount: number, rate: number, taxType: TaxType): number {
  return taxType === "inclusive"
    ? Math.floor((amount * rate) / (100 + rate))
    : Math.floor((amount * rate) / 100);
}

export function calculateTotals(items: ReceiptItem[], taxType: TaxType, discount: number): ReceiptTotals {
  const discounted = allocateDiscount(items, discount);
  const itemsTotal = items.reduce((acc, item) => acc + getLineTotal(item), 0);

  const amountByRate = new Map<number, number>();
  items.forEach((item, index) => {
    amountByRate.set(item.taxRate, (amountByRate.get(item.taxRate) ?? 0) + discounted[index]);
  });

  const breakdown: TaxBreakdown[] = [...amountByRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, taxableAmount]) => ({
      rate,
      taxableAmount,
      taxAmount: calculateTax(taxableAmount, rate, taxType),
    }));

  const subtotal = discounted.reduce((acc, value) => acc + value, 0);
  const taxAmount = breakdown.reduce((acc, row) => acc + row.taxAmount, 0);

  return {
    itemsTotal,
    discount: itemsTotal - subtotal,
    subtotal,
    taxAmount,
    total: taxType === "inclusive" ? subtotal : subtotal + taxAmount,
    breakdown,
  };
}

export function formatYen(amount: number | null): string {
  return amount === null ? "—" : `¥${amount.toLocaleString("ja-JP")}`;
}
