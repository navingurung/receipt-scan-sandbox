type FlowFooterProps = {
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  isPrimaryDisabled?: boolean;
};

export function FlowFooter({
  secondaryLabel,
  onSecondary,
  primaryLabel,
  onPrimary,
  isPrimaryDisabled = false,
}: FlowFooterProps) {
  return (
   <footer className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
      <button
        type="button"
        onClick={onSecondary}
        className="h-12 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {secondaryLabel}
      </button>
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
