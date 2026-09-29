export type TaxType = "inclusive" | "exclusive";

export type ReceiptItem = {
  id: string;
  name: string;
  janCode: string | null;
  quantity: number;
  // レシート記載の単価（税込/税抜は ScannedReceipt.taxType に従う）
  unitPrice: number;
  taxRate: number;
};

export type ScannedReceipt = {
  vendorName: string | null;
  date: string | null;
  receiptNumber: string | null;
  receiptTotal: number | null;
  receiptTax: number | null;
  taxType: TaxType;
  // false の場合は推定値 — スタッフに確認を促す
  isTaxTypeDetected: boolean;
  items: ReceiptItem[];
};

type VeryfiLineItem = {
  id?: number;
  description?: string | null;
  quantity?: number | null;
  price?: number | null;
  total?: number | null;
  tax_rate?: number | null;
  upc?: string | null;
  sku?: string | null;
};

type VeryfiDocument = {
  vendor?: { name?: string | null } | null;
  date?: string | null;
  invoice_number?: string | null;
  total?: number | null;
  tax?: number | null;
  ocr_text?: string | null;
  line_items?: VeryfiLineItem[] | null;
};

const STANDARD_RATE = 10;
const REDUCED_RATE = 8;
// 軽減税率対象を示す行頭マーク（例: ドン・キホーテの「*」）
const REDUCED_RATE_MARK = /^[\s]*[*＊※★☆]/;
const AMOUNT_TOLERANCE = 1;

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

function cleanItemName(description: string | null): string {
  // Veryfi は説明文に隣接行を含めることがあるため 1 行目のみ使用
  const firstLine = description?.split("\n")[0] ?? "";
  const cleaned = firstLine.replace(REDUCED_RATE_MARK, "").trim();
  return cleaned || "商品名不明";
}

function toJanCode(item: VeryfiLineItem): string | null {
  const digits = (item.upc ?? item.sku ?? "").replace(/\D/g, "");
  return digits.length === 13 || digits.length === 8 ? digits : null;
}

function getDefaultRate(ocrText: string): number {
  const hasStandard = /10(?:\.0+)?\s*[%％]/.test(ocrText);
  const hasReduced = /8(?:\.0+)?\s*[%％]/.test(ocrText);
  return hasReduced && !hasStandard ? REDUCED_RATE : STANDARD_RATE;
}

function resolveItemRate(item: VeryfiLineItem, ocrText: string, defaultRate: number): number {
  const hasReducedRate = /8(?:\.0+)?\s*[%％]/.test(ocrText);
  if (hasReducedRate && item.description && REDUCED_RATE_MARK.test(item.description)) {
    return REDUCED_RATE;
  }
  const rate = toNumber(item.tax_rate);
  return rate === STANDARD_RATE || rate === REDUCED_RATE ? rate : defaultRate;
}

// 1) レシート上の表記 → 2) 金額の整合性 の順で判定
function detectTaxType(
  ocrText: string,
  itemsSum: number,
  total: number | null,
  tax: number | null,
): { taxType: TaxType; isDetected: boolean } {
  if (/外税/.test(ocrText)) return { taxType: "exclusive", isDetected: true };
  if (/内税|[（(]内[）)]|\s内\s*[¥￥]/.test(ocrText)) return { taxType: "inclusive", isDetected: true };

  if (total !== null && itemsSum > 0) {
    if (isClose(itemsSum, total)) return { taxType: "inclusive", isDetected: true };
    if (tax !== null && isClose(itemsSum + tax, total)) return { taxType: "exclusive", isDetected: true };
  }
  // 総額表示が原則のため内税を既定値とする
  return { taxType: "inclusive", isDetected: false };
}

export function mapVeryfiDocument(data: unknown): ScannedReceipt {
  const doc = (typeof data === "object" && data !== null ? data : {}) as VeryfiDocument;
  const ocrText = doc.ocr_text ?? "";
  const defaultRate = getDefaultRate(ocrText);

  const items: ReceiptItem[] = (doc.line_items ?? []).map((item, index) => {
    const rawQuantity = toNumber(item.quantity);
    const quantity = rawQuantity !== null && rawQuantity > 0 ? rawQuantity : 1;
    const lineTotal = toNumber(item.total);
    const unitPrice = toNumber(item.price) ?? (lineTotal !== null ? Math.round(lineTotal / quantity) : 0);

    return {
      id: `scan-${item.id ?? index}`,
      name: cleanItemName(toText(item.description)),
      janCode: toJanCode(item),
      quantity,
      unitPrice,
      taxRate: resolveItemRate(item, ocrText, defaultRate),
    };
  });

  const total = toNumber(doc.total);
  const tax = toNumber(doc.tax);
  const itemsSum = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const { taxType, isDetected } = detectTaxType(ocrText, itemsSum, total, tax);

  return {
    vendorName: toText(doc.vendor?.name),
    date: toText(doc.date),
    receiptNumber: toText(doc.invoice_number),
    receiptTotal: total,
    receiptTax: tax,
    taxType,
    isTaxTypeDetected: isDetected,
    items,
  };
}
