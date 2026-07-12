/**
 * ProgressBar — accessible driver DQF completion bar (fixes QA-010).
 *
 * Replaces the previous `role="img"` + `aria-label` pattern with correct ARIA
 * progressbar semantics: `role="progressbar"` with `aria-valuenow`,
 * `aria-valuemin={0}` and `aria-valuemax={100}`, so assistive technology
 * announces the live completion percentage instead of a static image label.
 *
 * QA-023/QA-027: app/(dashboard)/dashboard/page.tsx and
 * app/(dashboard)/drivers/[id]/page.tsx — both MUST render this component in
 * place of their inline `role="img"` progress divs. Drop-in usage:
 *
 *   import { ProgressBar } from "@/components/progress-bar";
 *   <ProgressBar percent={percent} label={`DQF compliance for ${name}`} />
 *
 *   // Or pass DQF item counts directly (auto percent + "15 of 18 items current"):
 *   <ProgressBar current={currentCount} total={totalCount} label={`DQF compliance for ${name}`} />
 *
 * Any `role="img"` progress markup remaining in those pages is a regression
 * of this finding.
 *
 * Purely presentational (no hooks/handlers), so it is safe to use from both
 * Server and Client Components.
 */

export type ProgressBarTone = "green" | "amber" | "red" | "neutral";

export interface ProgressBarProps {
  /**
   * Completion percentage, 0–100. Out-of-range / non-finite values are
   * clamped. Optional when `current`/`total` counts are provided instead.
   */
  percent?: number;
  /** Accessible name, e.g. `DQF compliance for John Smith`. */
  label: string;
  /** Explicit status tone; defaults to a compliance tone derived from percent. */
  tone?: ProgressBarTone;
  /**
   * Optional richer announcement, e.g. `15 of 18 items current`. When omitted,
   * screen readers announce the numeric percentage from aria-valuenow.
   */
  valueText?: string;
  /**
   * Optional DQF item counts (e.g. 15 current of 18 total). When provided,
   * they derive `percent` (if omitted) and a default `aria-valuetext` of
   * "{current} of {total} items current" for richer SR announcements.
   */
  current?: number;
  total?: number;
  /** Tailwind height utility for the track (applied to track and fill). */
  heightClassName?: string;
  className?: string;
}

const TRACK_CLASSES: Record<ProgressBarTone, string> = {
  green: "bg-emerald-100",
  amber: "bg-amber-100",
  red: "bg-red-100",
  neutral: "bg-slate-200",
};

const FILL_CLASSES: Record<ProgressBarTone, string> = {
  green: "bg-emerald-600",
  amber: "bg-amber-500",
  red: "bg-red-600",
  neutral: "bg-slate-500",
};

/** Default tone mapping aligned with the DQF status colors used elsewhere. */
export function toneForPercent(percent: number): ProgressBarTone {
  if (percent >= 100) return "green";
  if (percent >= 75) return "amber";
  return "red";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Convenience for the QA-023 page migrations: derive percent from DQF item
 * counts (e.g. 15 of 18 items current), with safe handling of zero totals.
 */
export function percentFromCounts(current: number, total: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return clampPercent((current / total) * 100);
}

export function ProgressBar({
  percent,
  label,
  tone,
  valueText,
  current,
  total,
  heightClassName = "h-2",
  className = "",
}: ProgressBarProps) {
  const hasCounts =
    typeof current === "number" && typeof total === "number" && total > 0;
  const value = clampPercent(
    typeof percent === "number"
      ? percent
      : percentFromCounts(current ?? 0, total ?? 0),
  );
  const resolvedTone = tone ?? toneForPercent(value);
  const resolvedValueText =
    valueText ?? (hasCounts ? `${current} of ${total} items current` : undefined);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || "DQF completion"}
      aria-valuetext={resolvedValueText}
      className={`w-full overflow-hidden rounded-full ${heightClassName} ${TRACK_CLASSES[resolvedTone]} ${className}`.trim()}
    >
      <div
        aria-hidden="true"
        className={`${heightClassName} rounded-full ${FILL_CLASSES[resolvedTone]} transition-[width] duration-300 motion-reduce:transition-none`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default ProgressBar;
