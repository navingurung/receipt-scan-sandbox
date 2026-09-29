"use client";

import { useEffect, useState } from "react";

type SaveState = "idle" | "saved" | "failed";

type FlowFooterProps = {
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  isPrimaryDisabled?: boolean;
  // 指定時のみ「一時保存」ボタンを表示。成功時 true を返す
  onSaveDraft?: () => boolean;
};

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "一時保存",
  saved: "保存しました",
  failed: "保存できません",
};

const SAVE_FEEDBACK_MS = 2000;

export function FlowFooter({
  secondaryLabel,
  onSecondary,
  primaryLabel,
  onPrimary,
  isPrimaryDisabled = false,
  onSaveDraft,
}: FlowFooterProps) {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // 保存結果の表示を一定時間後に元へ戻す
  useEffect(() => {
    if (saveState === "idle") return;
    const timeoutId = window.setTimeout(() => setSaveState("idle"), SAVE_FEEDBACK_MS);
    return () => window.clearTimeout(timeoutId);
  }, [saveState]);

  return (
    <footer
      className={`sticky bottom-0 grid gap-3 border-t border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 ${
        onSaveDraft ? "grid-cols-3" : "grid-cols-2"
      }`}
    >
      <button
        type="button"
        onClick={onSecondary}
        className="h-12 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {secondaryLabel}
      </button>
      {onSaveDraft && (
        <button
          type="button"
          onClick={() => setSaveState(onSaveDraft() ? "saved" : "failed")}
          aria-live="polite"
          className={`h-12 rounded-lg border bg-white text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            saveState === "saved"
              ? "border-emerald-500 text-emerald-700"
              : saveState === "failed"
                ? "border-red-500 text-red-600"
                : "border-brand text-brand hover:bg-brand-light"
          }`}
        >
          {SAVE_LABEL[saveState]}
        </button>
      )}
      <button
        type="button"
        onClick={onPrimary}
        disabled={isPrimaryDisabled}
        className="h-12 rounded-lg bg-brand font-medium text-white hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        {primaryLabel}
      </button>
    </footer>
  );
}