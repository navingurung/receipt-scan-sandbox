import { calculateTotals, getLineTotal } from "./receipt-calc";
import type { ReceiptItem, ScannedReceipt, TaxType } from "./receipt-mapper";

export type ReceiptDraft = {
  vendorName: string | null;
  date: string | null;
  receiptNumber: string;
  receiptTotal: number | null;
  taxType: TaxType;
  isTaxTypeDetected: boolean;
  discount: number;
  items: ReceiptItem[];
};

export function createDraft(scanned: ScannedReceipt): ReceiptDraft {
  return {
    vendorName: scanned.vendorName,
    date: scanned.date,
    receiptNumber: scanned.receiptNumber ?? "",
    receiptTotal: scanned.receiptTotal,
    taxType: scanned.taxType,
    isTaxTypeDetected: scanned.isTaxTypeDetected,
    discount: 0,
    items: scanned.items,
  };
}

export function createEmptyItem(taxRate = 10): ReceiptItem {
  return {
    id: `manual-${crypto.randomUUID()}`,
    name: "",
    janCode: null,
    quantity: 1,
    unitPrice: 0,
    taxRate,
  };
}

// 送信内容（サンドボックスでは画面表示のみ）
export function toSubmissionPayload(draft: ReceiptDraft) {
  const totals = calculateTotals(draft.items, draft.taxType, draft.discount);
  return {
    receiptNumber: draft.receiptNumber.trim(),
    vendorName: draft.vendorName,
    purchasedAt: draft.date,
    taxType: draft.taxType,
    items: draft.items.map((item) => ({
      name: item.name,
      janCode: item.janCode,
      taxRate: item.taxRate,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: getLineTotal(item),
    })),
    totals,
  };
}
