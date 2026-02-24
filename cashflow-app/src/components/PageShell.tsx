/**
 * PageShell — mobile-safe page wrapper enforcing Velanovo's mobile design contract.
 *
 * Rules enforced:
 * - No horizontal overflow ever (overflow-x-hidden on <main> and the content div)
 * - Consistent max-width + horizontal padding (px-4 mobile, sm:px-6 desktop)
 * - Safe bottom padding so BottomNav never overlaps content (pb-40)
 * - Content width never exceeds 1100px on large screens
 *
 * Usage:
 *   <PageShell>
 *     <YourPageContent />
 *   </PageShell>
 *
 * If you need to opt out of the inner content wrapper (e.g. for full-bleed sections),
 * use <PageShell raw> and apply your own inner padding.
 */

type PageShellProps = {
  children: React.ReactNode;
  /** If true, omits the inner content wrapper so you control padding/max-width. */
  raw?: boolean;
  className?: string;
};

export function PageShell({ children, raw = false, className = "" }: PageShellProps) {
  return (
    <main className={`min-h-screen w-full max-w-full overflow-x-hidden ${className}`}>
      {raw ? (
        children
      ) : (
        <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 pb-40 pt-5">
          {children}
        </div>
      )}
    </main>
  );
}
