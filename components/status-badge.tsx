import type { ReactNode } from "react";

/**
 * Shared status badge for DQF item / driver compliance states.
 * Pure presentational component — safe to render from both server and
 * client components (no hooks, no browser APIs).
 */

export type DqfStatus =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "missing"
  | "not_required";

/** Normalize the many spellings of a compliance status into a canonical one. */
export function normalizeStatus(input?: string | null): DqfStatus {
  const s = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, "_");
  switch (s) {
    case "valid":
    case "ok":
    case "current":
    case "active":
    case "compliant":
    case "complete":
    case "good":
      return "valid";
    case "expiring":
    case "expiring_soon":
    case "due_soon":
    case "warning":
    case "attention":
      return "expiring_soon";
    case "expired":
    case "overdue":
    case "violation":
    case "critical":
      return "expired";
    case "not_required":
    case "not_applicable":
    case "na":
    case "n_a":
    case "exempt":
      return "not_required";
    default:
      return "missing";
  }
}

/** Human-readable label for a status value. */
export function statusLabel(status?: string | null): string {
  switch (normalizeStatus(status)) {
    case "valid":
      return "Current";
    case "expiring_soon":
      return "Expiring soon";
    case "expired":
      return "Expired";
    case "not_required":
      return "Not required";
    default:
      return "Missing";
  }
}

const STATUS_CLASSES: Record<DqfStatus, string> = {
  valid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  expiring_soon: "border-amber-200 bg-amber-50 text-amber-700",
  expired: "border-red-200 bg-red-50 text-red-700",
  missing: "border-slate-200 bg-slate-50 text-slate-500",
  not_required: "border-slate-200 bg-white text-slate-400",
};

export interface StatusBadgeProps {
  status?: string | null;
  /** Optional custom label; defaults to a human-readable label for the status. */
  label?: ReactNode;
  className?: string;
  /** Tolerate extra props from call sites without breaking the build. */
  [key: string]: unknown;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[normalized],
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        aria-hidden="true"
      />
      {label ?? statusLabel(normalized)}
    </span>
  );
}

export default StatusBadge;
