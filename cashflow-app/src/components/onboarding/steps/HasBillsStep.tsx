"use client";

export interface HasBillsStepProps {
  hasBills: boolean | null;
  onSelect: (value: boolean) => void;
}

export function HasBillsStep({ hasBills, onSelect }: HasBillsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-(--vn-text)">Do you have fixed monthly bills?</h2>
        <p className="mt-2 text-sm text-(--vn-muted)">
          Rent, utilities, phone — things due on the same day each month.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSelect(true)}
          className={`rounded-2xl p-5 text-left transition-all border-2 ${
            hasBills === true
              ? "border-(--vn-primary) bg-(--vn-primary)/10"
              : "border-(--vn-border) hover:border-(--vn-primary)/50"
          }`}
        >
          <div className="text-2xl mb-2">Yes</div>
          <div className="text-xs text-(--vn-muted)">We&apos;ll add common ones you can edit later</div>
        </button>
        <button
          onClick={() => onSelect(false)}
          className={`rounded-2xl p-5 text-left transition-all border-2 ${
            hasBills === false
              ? "border-(--vn-primary) bg-(--vn-primary)/10"
              : "border-(--vn-border) hover:border-(--vn-primary)/50"
          }`}
        >
          <div className="text-2xl mb-2">No</div>
          <div className="text-xs text-(--vn-muted)">Start with just income, add bills later</div>
        </button>
      </div>
    </div>
  );
}
