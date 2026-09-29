"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ScanIcon, UploadIcon } from "@/components/icons";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type StartStepProps = {
  onScan: () => void;
  onUpload: (image: Blob) => void;
};

export function StartStep({ onScan, onUpload }: StartStepProps) {
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
