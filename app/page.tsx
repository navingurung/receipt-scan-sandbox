"use client";

import { useCallback, useEffect, useState } from "react";
import { FlowHeader } from "@/components/flow-header";
import { ReceiptScanner } from "@/components/receipt-scanner";
import { ConfirmStep } from "@/components/steps/confirm-step";
import { ItemsStep } from "@/components/steps/items-step";
import { ScanningStep } from "@/components/steps/scanning-step";
import { StartStep } from "@/components/steps/start-step";
import { SubmittedStep } from "@/components/steps/submitted-step";
import { createDraft, toSubmissionPayload, type ReceiptDraft } from "@/lib/receipt-draft";
import { mapVeryfiDocument } from "@/lib/receipt-mapper";

type Step = "start" | "scanning" | "items" | "confirm" | "submitted";

const TOTAL_STEPS = 3;

const STEP_META: Record<Step, { title: string; index: number }> = {
  start: { title: "レシート読み取り", index: 1 },
  scanning: { title: "読み取り中", index: 1 },
  items: { title: "免税品", index: 2 },
  confirm: { title: "最終確認", index: 3 },
  submitted: { title: "送信完了", index: 3 },
};

function getErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return `読み取りに失敗しました（${data.error}）`;
  }
  return `読み取りに失敗しました（${status}）`;
}

function getFileExtension(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export default function Home() {
  const [step, setStep] = useState<Step>("start");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [rawData, setRawData] = useState<unknown>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [payload, setPayload] = useState<unknown>(null);

  // 前回のプレビュー URL を解放
  useEffect(() => {
    if (!imageUrl) return;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const processImage = useCallback(async (image: Blob) => {
    setIsScannerOpen(false);
    setImageUrl(URL.createObjectURL(image));
    setScanError(null);
    setStep("scanning");

    const formData = new FormData();
    formData.append("file", image, `receipt.${getFileExtension(image.type)}`);
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/receipt-scan", { method: "POST", body: formData });
      const data: unknown = await response.json();

      if (!response.ok) {
        setScanError(getErrorMessage(data, response.status));
        return;
      }
      setDurationMs(Math.round(performance.now() - startedAt));
      setRawData(data);
      setDraft(createDraft(mapVeryfiDocument(data)));
      setStep("items");
    } catch {
      setScanError("通信エラーが発生しました。もう一度お試しください。");
    }
  }, []);

  const openScanner = useCallback(() => setIsScannerOpen(true), []);
  const closeScanner = useCallback(() => setIsScannerOpen(false), []);

  const restart = () => {
    setStep("start");
    setDraft(null);
    setRawData(null);
    setPayload(null);
    setScanError(null);
    setImageUrl(null);
  };

  const meta = STEP_META[step];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-slate-50 shadow-sm md:max-w-3xl">
      <FlowHeader title={meta.title} step={meta.index} totalSteps={TOTAL_STEPS} />

      {step === "start" && <StartStep onScan={openScanner} onUpload={processImage} />}

      {step === "scanning" && imageUrl && (
        <ScanningStep imageUrl={imageUrl} error={scanError} onRetry={restart} />
      )}

      {step === "items" && draft && (
        <ItemsStep
          draft={draft}
          onDraftChange={setDraft}
          rawData={rawData}
          durationMs={durationMs}
          onRescan={openScanner}
          onBack={restart}
          onNext={() => setStep("confirm")}
        />
      )}

      {step === "confirm" && draft && (
        <ConfirmStep
          draft={draft}
          onBack={() => setStep("items")}
          onSubmit={() => {
            setPayload(toSubmissionPayload(draft));
            setStep("submitted");
          }}
        />
      )}

      {step === "submitted" && <SubmittedStep payload={payload} onRestart={restart} />}

      {isScannerOpen && <ReceiptScanner onCapture={processImage} onClose={closeScanner} />}
    </div>
  );
}
