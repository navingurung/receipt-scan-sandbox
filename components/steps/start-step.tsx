"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ScanIcon, UploadIcon } from "@/components/icons";
import type { SavedDraft } from "@/lib/draft-storage";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type StartStepProps = {
  onScan: () => void;
  onUpload: (image: Blob) => void;
  savedDraft: SavedDraft | null;
  onResumeDraft: () => void;
  onDiscardDraft: () => void;
};

function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
}

export function StartStep({ onScan, onUpload, savedDraft, onResumeDraft, onDiscardDraft }: StartStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 同じファイルを再選択できるようにリセット
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("JPEG・PNG・WebP の画像を選択してください。");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("10MB 以下の画像を選択してください。");
      return;
    }
    setError(null);
    onUpload(file);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-3">
        {savedDraft && (
          <section className="mb-6 rounded-lg border border-brand/30 bg-white p-4" aria-labelledby="saved-draft-heading">
            <h2 id="saved-draft-heading" className="font-medium text-slate-900">
              保存中の下書きがあります
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {savedDraft.draft.vendorName ?? "店舗名不明"}（商品 {savedDraft.draft.items.length} 点）
            </p>
            <p className="text-xs text-slate-500">保存日時 {formatSavedAt(savedDraft.savedAt)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("下書きを破棄しますか？")) onDiscardDraft();
                }}
                className="h-11 rounded-lg border border-red-300 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                破棄
              </button>
              <button
                type="button"
                onClick={onResumeDraft}
                className="h-11 rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-dark"
              >
                再開
              </button>
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={onScan}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand font-medium text-white hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <ScanIcon />
          レシートスキャン
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-brand bg-white font-medium text-brand hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <UploadIcon />
          画像アップロード
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />

        {error && (
          <p role="alert" className="pt-1 text-center text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}