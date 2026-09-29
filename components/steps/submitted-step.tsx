type SubmittedStepProps = {
  payload: unknown;
  onRestart: () => void;
};

export function SubmittedStep({ payload, onRestart }: SubmittedStepProps) {
  return (
    <div className="flex-1 space-y-4 px-4 py-6">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        送信しました（サンドボックスのため送信内容の表示のみ）
      </div>
      <pre className="max-h-[60vh] overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
        {JSON.stringify(payload, null, 2)}
      </pre>
      <button
        type="button"
        onClick={onRestart}
        className="h-12 w-full rounded-lg bg-brand font-medium text-white hover:bg-brand-dark"
      >
        新しいレシートを読み取る
      </button>
    </div>
  );
}
