/**
 * Shared utility helpers (client- and server-safe, dependency-free).
 *
 * Several components import `cn` / date helpers from "@/lib/utils"; this
 * module was missing, which caused `next build` to fail with a
 * module-not-found compile error.
 */

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

/**
 * Merge conditional className values into a single string.
 * Dependency-free equivalent of clsx: skips falsy values, flattens arrays.
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue): void => {
    if (value === null || value === undefined || value === false || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    out.push(String(value));
  };
  for (const input of inputs) walk(input);
  return out.join(" ");
}

/** Alias kept for components that import `classNames` instead of `cn`. */
export const classNames = cn;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a date as e.g. "Mar 5, 2025". Returns an em dash for empty/invalid input. */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "\u2014";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a date + time as e.g. "Mar 5, 2025, 3:42 PM". */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "\u2014";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Whole days from today (local midnight) until the given date.
 * Negative = already past. Returns null for empty/invalid input.
 */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const d = toDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** True if the given expiration date is strictly before today. */
export function isExpired(value: string | Date | null | undefined): boolean {
  const days = daysUntil(value);
  return days !== null && days < 0;
}

/** Simple pluralizer: plural(1, "day") -> "1 day", plural(3, "day") -> "3 days". */
export function plural(count: number, noun: string, suffix = "s"): string {
  return `${count} ${noun}${count === 1 ? "" : suffix}`;
}
