import { BackIcon } from "@/components/icons";

type FlowHeaderProps = {
  title: string;
  // 1 始まり。進捗バー表示用
  step: number;
  totalSteps: number;
  onBack?: () => void;
};

export function FlowHeader({ title, step, totalSteps, onBack }: FlowHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-brand px-4 pb-3 pt-4 text-white">
      <div className="relative flex h-8 items-center justify-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-0 flex items-center gap-1 rounded px-1 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
          >
            <BackIcon size={18} />
            戻る
          </button>
        )}
        <h1 className="text-base font-semibold">{title}</h1>
      </div>
      <div className="mt-3 flex gap-1.5" aria-label={`ステップ ${step} / ${totalSteps}`}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${index < step ? "bg-white" : "bg-white/30"}`}
          />
        ))}
      </div>
    </header>
  );
}
