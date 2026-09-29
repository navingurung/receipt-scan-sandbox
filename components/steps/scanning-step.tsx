type ScanningStepProps = {
  imageUrl: string;
  error: string | null;
  onRetry: () => void;
};

export function ScanningStep({ imageUrl, error, onRetry }: ScanningStepProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="relative w-full max-w-60 overflow-hidden rounded-lg border border-slate-200 bg-black shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- blob URL のため next/image は不要 */}
        <img src={imageUrl} alt="読み取り中のレシート" className="block w-full" />
        {!error && (
          <>
            <div className="absolute inset-0 bg-brand/10" />
            <div className="animate-scan-line-fast absolute inset-x-0 h-1 bg-emerald-400 shadow-[0_0_16px_4px_rgba(52,211,153,0.8)]" />
          </>
        )}
      </div>

      {error ? (
        <div className="space-y-3 text-center">
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            最初に戻る
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-600" aria-live="polite">
          レシートを読み取っています…
        </p>
      )}
    </div>
  );
}
