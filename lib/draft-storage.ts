import { useMemo, useSyncExternalStore } from "react";
import type { ReceiptDraft } from "./receipt-draft";

// 端末内（localStorage）に 1 件だけ保存する一時保存。画像は容量が大きいため保存しない
const STORAGE_KEY = "receipt-scan-sandbox:draft";
const CHANGE_EVENT = "receipt-draft-change";
const STORAGE_VERSION = 1;

export type SavedDraft = {
  version: typeof STORAGE_VERSION;
  savedAt: string;
  draft: ReceiptDraft;
};

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string): SavedDraft | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "version" in value &&
      value.version === STORAGE_VERSION &&
      "savedAt" in value &&
      typeof value.savedAt === "string" &&
      "draft" in value &&
      value.draft &&
      typeof value.draft === "object" &&
      "items" in value.draft &&
      Array.isArray(value.draft.items)
    ) {
      return value as SavedDraft;
    }
  } catch {
    // 壊れたデータは無視
  }
  return null;
}

function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveDraft(draft: ReceiptDraft): boolean {
  try {
    const saved: SavedDraft = { version: STORAGE_VERSION, savedAt: new Date().toISOString(), draft };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    notifyChange();
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 削除できなくても処理は継続
  }
  notifyChange();
}

function subscribe(onChange: () => void) {
  // 他タブの変更（storage）と同一タブの変更（独自イベント）の両方を購読
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useSavedDraft(): SavedDraft | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => (raw ? parse(raw) : null), [raw]);
}