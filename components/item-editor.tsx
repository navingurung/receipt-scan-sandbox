"use client";

import { useId, useState } from "react";
import { TAX_RATES } from "@/lib/receipt-calc";
import type { ReceiptItem, TaxType } from "@/lib/receipt-mapper";

type ItemEditorProps = {
  item: ReceiptItem;
  taxType: TaxType;
  onSave: (item: ReceiptItem) => void;
  onCancel: () => void;
};

const inputClass =
  "mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function ItemEditor({ item, taxType, onSave, onCancel }: ItemEditorProps) {
  const formId = useId();
  const [name, setName] = useState(item.name);
  const [janCode, setJanCode] = useState(item.janCode ?? "");
  const [taxRate, setTaxRate] = useState(item.taxRate);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitPrice, setUnitPrice] = useState(String(item.unitPrice));

  const parsedQuantity = Number(quantity);
  const parsedPrice = Number(unitPrice);
  const trimmedJan = janCode.trim();
  const isJanValid = trimmedJan === "" || /^(\d{8}|\d{13})$/.test(trimmedJan);
  const isValid =
    name.trim() !== "" &&
    isJanValid &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity > 0 &&
    Number.isInteger(parsedPrice) &&
    parsedPrice >= 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      ...item,
      name: name.trim(),
      janCode: trimmedJan || null,
      taxRate,
      quantity: parsedQuantity,
      unitPrice: parsedPrice,
    });
  };

  return (
    <div className="space-y-3 rounded-lg border-2 border-brand bg-white p-4 md:col-span-2">
      <label className="block text-sm text-slate-700" htmlFor={`${formId}-name`}>
        商品名
        <input id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>

      <label className="block text-sm text-slate-700" htmlFor={`${formId}-jan`}>
        JANコード（任意）
        <input
          id={`${formId}-jan`}
          inputMode="numeric"
          value={janCode}
          onChange={(e) => setJanCode(e.target.value.replace(/\D/g, ""))}
          aria-invalid={!isJanValid}
          className={inputClass}
        />
        {!isJanValid && <span className="mt-1 block text-xs text-red-600">8桁または13桁で入力してください</span>}
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm text-slate-700" htmlFor={`${formId}-rate`}>
          税率
          <select
            id={`${formId}-rate`}
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            className={inputClass}
          >
            {TAX_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-700" htmlFor={`${formId}-quantity`}>
          数量
          <input
            id={`${formId}-quantity`}
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-slate-700" htmlFor={`${formId}-price`}>
          単価（{taxType === "inclusive" ? "税込" : "税抜"}）
          <input
            id={`${formId}-price`}
            type="number"
            min={0}
            step={1}
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-md border border-slate-300 px-5 text-sm text-slate-700 hover:bg-slate-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className="h-11 rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          保存
        </button>
      </div>
    </div>
  );
}