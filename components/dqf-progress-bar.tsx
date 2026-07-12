'use client';

import * as React from 'react';

/**
 * Accessible driver-qualification-file (DQF) completion progress bar.
 *
 * Renders an ARIA progressbar so screen readers announce the exact
 * completion percentage (e.g. "14 of 18 DQF items compliant, 78%").
 * This replaces the prior role='img' + aria-label approach on the
 * dashboard and driver-detail pages, which did not expose a live
 * numeric value to assistive technology (QA-010).
 *
 * The visual status color (border/fill) remains a redundant cue only;
 * the percentage text and ARIA value are the primary differentiators.
 */

export type DqfProgressTone = 'compliant' | 'warning' | 'expired' | 'neutral';

export interface DqfProgressBarProps {
  /** Number of DQF items currently in a compliant state. */
  completed: number;
  /** Total number of tracked DQF items (typically 18). */
  total: number;
  /**
   * Optional accessible label prefix. The component always appends the
   * numeric "X of Y (N%)" summary so the announcement is self-describing.
   */
  label?: string;
  /** Visual tone; defaults to a threshold-derived value. */
  tone?: DqfProgressTone;
  /** Show the textual "X / Y" and percent next to the bar. */
  showText?: boolean;
  className?: string;
}

const TONE_FILL: Record<DqfProgressTone, string> = {
  compliant: 'bg-emerald-500',
  warning: 'bg-amber-500',
  expired: 'bg-red-500',
  neutral: 'bg-slate-400',
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function deriveTone(percent: number): DqfProgressTone {
  if (percent >= 100) return 'compliant';
  if (percent >= 80) return 'warning';
  if (percent <= 0) return 'neutral';
  return 'expired';
}

export function DqfProgressBar({
  completed,
  total,
  label = 'DQF items compliant',
  tone,
  showText = true,
  className,
}: DqfProgressBarProps) {
  const safeTotal = total > 0 ? total : 0;
  const safeCompleted = Math.max(0, Math.min(completed, safeTotal));
  const percent = clampPercent(
    safeTotal === 0 ? 0 : Math.round((safeCompleted / safeTotal) * 100),
  );
  const resolvedTone = tone ?? deriveTone(percent);
  const fillClass = TONE_FILL[resolvedTone];

  const accessibleText = `${safeCompleted} of ${safeTotal} ${label} (${percent}%)`;

  return (
    <div className={['flex items-center gap-3', className].filter(Boolean).join(' ')}>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={accessibleText}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${fillClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {showText ? (
        <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
          <span className="sr-only">{accessibleText}</span>
          <span aria-hidden="true">
            {safeCompleted}/{safeTotal}
            <span className="ml-1 text-slate-400">({percent}%)</span>
          </span>
        </span>
      ) : null}
    </div>
  );
}

export default DqfProgressBar;
