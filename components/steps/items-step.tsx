"use client";

import { useState } from "react";
import { FlowFooter } from "@/components/flow-footer";
import { PlusIcon, RetakeIcon } from "@/components/icons";
import { ItemCard } from "@/components/item-card";
import { ItemEditor } from "@/components/item-editor";
import { calculateTotals, formatYen } from "@/lib/receipt-calc";
import { createEmptyItem, type ReceiptDraft } from "@/lib/receipt-draft";
import type { ReceiptItem, TaxType } from "@/lib/receipt-mapper";

type ItemsStepProps = {
  draft: ReceiptDraft;
  onDraftChange: (draft: ReceiptDraft) => void;
  rawData: unknown;
  durationMs: number;
  onRescan: () => void;
  onBack: () => void;
  onNext: () => void;
};

const TAX_TYPE_OPTIONS: { value: TaxType; label: string }[] = [
  { value: "inclusive", label: "内税（税込）" },
  { value: "exclusive", label: "外税（税抜）" },
];

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function ItemsStep({ draft, onDraftChange, rawData, durationMs, onRescan, onBack, onNext }: ItemsStepProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<ReceiptItem | null>(null);

  const totals = calculateTotals(draft.items, draft.taxType, draft.discount);
  const hasTotalMismatch =
    draft.discount === 0 && draft.receiptTotal !== null && Math.abs(totals.total - draft.receiptTotal) > 1;
  const isEditing = editingId !== null || newItem !== null;
  const canProceed = draft.receiptNumber.trim() !== "" && draft.items.length > 0 && !isEditing;

  const update = (patch: Partial<ReceiptDraft>) => onDraftChange({ ...draft, ...patch });

  const replaceItem = (updated: ReceiptItem) =>
    update({ items: draft.items.map((item) => (item.id === updated.id ? updated : item)) });

  const deleteItem = (id: string) => update({ items: draft.items.filter((item) => item.id !== id) });

  const handleDiscountChange = (value: string) => {
    const parsed = Number(value);
    update({ discount: Number.isInteger(parsed) && parsed > 0 ? parsed : 0 });
  };

  return (
    <>
      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onRescan}
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RetakeIcon size={18} />
            再撮影
          </button>
          <button
            type="button"
            onClick={() => setNewItem(createEmptyItem())}
            disabled={isEditing}
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <PlusIcon size={18} />
            商品を追加
          </button>
        </div>

        {(draft.vendorName || draft.date) && (
          <p className="text-sm text-slate-500">
            {draft.vendorName ?? "店舗名不明"}
            {draft.date && <span className="ml-2 tabular-nums">{draft.date}</span>}
          </p>
        )}

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">税区分</legend>
          <div className="mt-1 grid grid-cols-2 rounded-lg border border-slate-300 bg-white p-1">
            {TAX_TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md py-2 text-center text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-brand ${
                  draft.taxType === option.value ? "bg-brand font-medium text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="tax-type"
                  value={option.value}
                  checked={draft.taxType === option.value}
                  onChange={() => update({ taxType: option.value, isTaxTypeDetected: true })}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
          {!draft.isTaxTypeDetected && (
            <p className="mt-1.5 text-xs text-amber-700">
              税区分を自動判定できませんでした。レシートを確認して選択してください。
            </p>
          )}
        </fieldset>

        <label className="block text-sm font-medium text-slate-700" htmlFor="receipt-number">
          レシート番号 <span className="text-red-600">*</span>
          <input
            id="receipt-number"
            value={draft.receiptNumber}
            onChange={(e) => update({ receiptNumber: e.target.value })}
            aria-required="true"
            className={inputClass}
          />
        </label>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-600">
              合計金額（{draft.taxType === "inclusive" ? "税込" : "税抜＋消費税"}）
            </span>
            <span className="text-xl font-semibold tabular-nums text-slate-900">{formatYen(totals.total)}</span>
          </div>
          {hasTotalMismatch && (
            <p role="alert" className="mt-2 text-xs text-amber-700">
              レシートの合計（{formatYen(draft.receiptTotal)}）と一致しません。商品と税区分を確認してください。
            </p>
          )}
        </div>

        <label className="block text-sm font-medium text-slate-700" htmlFor="discount">
          小計値引額
          <input
            id="discount"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={draft.discount === 0 ? "" : draft.discount}
            placeholder="0"
            onChange={(e) => handleDiscountChange(e.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            入力した値引額は各明細行に按分されます
          </span>
        </label>

        <section className="space-y-3" aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-sm font-medium text-slate-700">
            追加された商品（{draft.items.length}）
          </h2>

          {newItem && (
            <ItemEditor
              item={newItem}
              taxType={draft.taxType}
              onSave={(saved) => {
                update({ items: [...draft.items, saved] });
                setNewItem(null);
              }}
              onCancel={() => setNewItem(null)}
            />
          )}

          {draft.items.length === 0 && !newItem && (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              商品を検出できませんでした。「商品を追加」から入力してください。
            </p>
          )}

          {draft.items.map((item) =>
            editingId === item.id ? (
              <ItemEditor
                key={item.id}
                item={item}
                taxType={draft.taxType}
                onSave={(saved) => {
                  replaceItem(saved);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ItemCard
                key={item.id}
                item={item}
                taxType={draft.taxType}
                onEdit={() => setEditingId(item.id)}
                onDelete={() => deleteItem(item.id)}
              />
            ),
          )}
        </section>

        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">デバッグ情報（読み取り {(durationMs / 1000).toFixed(2)} 秒）</summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-slate-100">
            {JSON.stringify(rawData, null, 2)}
          </pre>
        </details>
      </div>

      <FlowFooter
        secondaryLabel="戻る"
        onSecondary={onBack}
        primaryLabel="次へ"
        onPrimary={onNext}
        isPrimaryDisabled={!canProceed}
      />
    </>
  );
}
