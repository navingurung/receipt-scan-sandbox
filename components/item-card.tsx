import { CloseIcon, PencilIcon } from "@/components/icons";
import { formatYen, getLineTotal } from "@/lib/receipt-calc";
import type { ReceiptItem, TaxType } from "@/lib/receipt-mapper";

type ItemCardProps = {
  item: ReceiptItem;
  taxType: TaxType;
  onEdit: () => void;
  onDelete: () => void;
};

export function ItemCard({ item, taxType, onEdit, onDelete }: ItemCardProps) {
  const taxLabel = taxType === "inclusive" ? "税込" : "税抜";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-slate-900">{item.name}</h3>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${item.name}を編集`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand"
          >
            <PencilIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`${item.name}を削除`}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-600"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-slate-600">
        <dt>税率</dt>
        <dd>{item.taxRate}%</dd>
        <dt>JANコード</dt>
       <dd className="tabular-nums">{item.janCode ?? "—"}</dd>
        <dt>販売単価（{taxLabel}）</dt>
        <dd className="tabular-nums">{formatYen(item.unitPrice)}</dd>
      </dl>

      <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-600">数量 {item.quantity}</span>
        <span className="font-semibold tabular-nums text-slate-900">
          {formatYen(getLineTotal(item))}
          <span className="ml-1 text-xs font-normal text-slate-500">（{taxLabel}）</span>
        </span>
      </div>
    </article>
  );
}
