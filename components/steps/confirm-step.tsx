import { FlowFooter } from "@/components/flow-footer";
import { calculateTotals, formatYen, getLineTotal } from "@/lib/receipt-calc";
import type { ReceiptDraft } from "@/lib/receipt-draft";

type ConfirmStepProps = {
  draft: ReceiptDraft;
  onBack: () => void;
  onSubmit: () => void;
};

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${emphasis ? "text-base font-semibold text-slate-900" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function ConfirmStep({ draft, onBack, onSubmit }: ConfirmStepProps) {
  const totals = calculateTotals(draft.items, draft.taxType, draft.discount);
  const isInclusive = draft.taxType === "inclusive";
  const priceLabel = isInclusive ? "税込" : "税抜";

  return (
    <>
      <div className="flex-1 px-4 py-5">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
          <div className="text-center">
            <p className="text-base font-semibold text-slate-900">{draft.vendorName ?? "店舗名不明"}</p>
            {draft.date && <p className="mt-1 tabular-nums">{draft.date}</p>}
            <p className="mt-1 tabular-nums">レシート番号 {draft.receiptNumber}</p>
          </div>

          <ol className="mt-5 space-y-4 border-t border-dashed border-slate-300 pt-5">
            {draft.items.map((item, index) => (
              <li key={item.id}>
                <p className="font-medium text-slate-900">
                  No.{index + 1} {item.name}
                </p>
                <dl className="mt-1 space-y-0.5">
                  <Row label="税率" value={`${item.taxRate}%`} />
                  <Row label="JANコード" value={item.janCode ?? "—"} />
                  <Row label="数量" value={String(item.quantity)} />
                  <Row label={`販売単価（${priceLabel}）`} value={formatYen(item.unitPrice)} />
                  <Row label="小計" value={formatYen(getLineTotal(item))} />
                </dl>
              </li>
            ))}
          </ol>

          <dl className="mt-5 space-y-1 border-t border-dashed border-slate-300 pt-5">
            {totals.discount > 0 && (
              <>
                <Row label="商品合計" value={formatYen(totals.itemsTotal)} />
                <Row label="小計値引" value={`−${formatYen(totals.discount)}`} />
              </>
            )}
            <Row label={`小計（${priceLabel}）`} value={formatYen(totals.subtotal)} />
            <Row label={isInclusive ? "消費税（内税）" : "消費税"} value={formatYen(totals.taxAmount)} />
            <Row label="合計（税込）" value={formatYen(totals.total)} emphasis />
          </dl>

          <div className="mt-5 border-t border-dashed border-slate-300 pt-5">
            <p className="font-medium text-slate-900">税率別内訳</p>
            <dl className="mt-1 space-y-0.5">
              {totals.breakdown.map((row) => (
                <div key={row.rate} className="space-y-0.5">
                  <Row label={`${row.rate}%対象（${priceLabel}）`} value={formatYen(row.taxableAmount)} />
                  <Row label="消費税額" value={formatYen(row.taxAmount)} />
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <FlowFooter secondaryLabel="戻る" onSecondary={onBack} primaryLabel="送信" onPrimary={onSubmit} />
    </>
  );
}
