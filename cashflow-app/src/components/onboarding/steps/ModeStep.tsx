"use client";

export interface ModeStepProps {
  mode: "forecast" | "track" | null;
  onSelect: (mode: "forecast" | "track") => void;
}

export function ModeStep({ mode, onSelect }: ModeStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-(--vn-text)">How do you want to use the app?</h2>
        <p className="mt-2 text-sm text-(--vn-muted)">You can change this anytime in Settings.</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => onSelect("forecast")}
          className={`rounded-2xl p-5 text-left transition-all border-2 ${
            mode === "forecast"
              ? "border-(--vn-primary) bg-(--vn-primary)/10"
              : "border-(--vn-border) hover:border-(--vn-primary)/50"
          }`}
        >
          <div className="text-base font-semibold text-(--vn-text)">Forecast ahead</div>
          <div className="text-xs text-(--vn-muted) mt-1">
            See projected balance based on your income, bills, and spending rules.
          </div>
        </button>
        <button
          onClick={() => onSelect("track")}
          className={`rounded-2xl p-5 text-left transition-all border-2 ${
            mode === "track"
              ? "border-(--vn-primary) bg-(--vn-primary)/10"
              : "border-(--vn-border) hover:border-(--vn-primary)/50"
          }`}
        >
          <div className="text-base font-semibold text-(--vn-text)">Track as I go</div>
          <div className="text-xs text-(--vn-muted) mt-1">
            Log transactions and roll your actual balance forward each period.
          </div>
        </button>
      </div>
    </div>
  );
}
