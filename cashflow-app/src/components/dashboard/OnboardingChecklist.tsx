import Link from "next/link";
import { useEffect } from "react";

interface OnboardingTask {
  id: string;
  label: string;
  href: string;
  done: boolean;
  autoDone: boolean;
}

interface OnboardingChecklistProps {
  onboardingTasks: OnboardingTask[];
  completedCount: number;
  isFirstVisit: boolean;
  onDismiss: () => void;
  onLoadSampleData: () => void;
  onSetup: () => void;
  onToggleTask: (id: string, done: boolean) => void;
}

/**
 * Getting-started checklist panel rendered inside a `vn-card` wrapper in
 * `page.tsx`. Shows task progress, quick-action buttons, and the task list.
 */
export function OnboardingChecklist({
  onboardingTasks,
  completedCount,
  isFirstVisit,
  onDismiss,
  onLoadSampleData,
  onSetup,
  onToggleTask,
}: OnboardingChecklistProps) {
  const pendingTasks = onboardingTasks.filter((t) => !t.done);
  const allDone = onboardingTasks.every((t) => t.done);

  useEffect(() => {
    if (!allDone) return;
    const id = setTimeout(() => onDismiss?.(), 4_000);
    return () => clearTimeout(id);
  }, [allDone, onDismiss]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-(--vn-text)">Getting started</div>
          <div className="mt-1 text-xs text-(--vn-muted)">
            {completedCount} of {onboardingTasks.length} steps done
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs font-semibold text-(--vn-muted) hover:text-(--vn-text) transition-colors"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onLoadSampleData}
          className="vn-btn vn-btn-primary text-sm sm:text-xs h-11 sm:h-8 px-4 sm:px-3"
        >
          Try demo data
          {isFirstVisit && (
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
              Recommended
            </span>
          )}
        </button>
        <button
          onClick={onSetup}
          className="vn-btn vn-btn-ghost text-sm sm:text-xs h-11 sm:h-8 px-4 sm:px-3"
        >
          Quick setup
        </button>
      </div>

      <div className="mt-2 text-xs text-(--vn-muted)">
        Explore a prefilled plan to see insights immediately. You can reset to a blank plan anytime.
      </div>

      <div className="mt-4 space-y-2">
        {pendingTasks.slice(0, 3).map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-2 bg-(--vn-bg)"
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={task.done}
                onChange={(e) => onToggleTask(task.id, e.target.checked)}
                disabled={task.autoDone}
                className="w-4 h-4 accent-(--vn-primary) rounded"
              />
              <span className="text-sm font-medium text-(--vn-text)">{task.label}</span>
            </label>
            <Link href={task.href} className="text-xs font-semibold text-(--vn-primary)">
              Go
            </Link>
          </div>
        ))}
        {pendingTasks.length > 3 && (
          <div className="text-xs text-center text-(--vn-muted) mt-2">
            ...and {pendingTasks.length - 3} more
          </div>
        )}
        {allDone && (
          <div className="text-sm text-(--vn-success) font-medium text-center py-2">
            🎉 You&apos;re all set! This card will close in a moment.
          </div>
        )}
      </div>
    </>
  );
}
