"use client";

/**
 * Shared upgrade-modal UI and shared class-string constants.
 *
 * Extracted per QA-014: the UpgradeModal content was previously copy-pasted
 * verbatim across the dashboard, drivers/[id], and audit-files pages, and the
 * btnPrimary/btnSecondary/inputClass strings were duplicated in five files.
 *
 * QA-028 (closes QA-025): the single canonical Modal implementation lives
 * in THIS module. components/modal.tsx is superseded, is no longer imported
 * by anything, and should be deleted. Pages must import Modal from here
 * instead of keeping inline copies.
 *
 * Usage (dashboard, drivers/[id], audit-files, settings, billing):
 *
 *   import {
 *     Modal,
 *     UpgradeModal,
 *     btnPrimary,
 *     btnSecondary,
 *     inputClass,
 *   } from "@/components/ui/upgrade-modal";
 */

import Link from "next/link";
import { useCallback, useEffect, useId, useRef } from "react";

/* ------------------------------------------------------------------------ */
/* Shared class-string constants (previously duplicated in five files)       */
/* ------------------------------------------------------------------------ */

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60";

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50";

export const labelClass = "mb-1 block text-sm font-medium text-slate-700";

/* ------------------------------------------------------------------------ */
/* Modal — single canonical implementation (QA-028; supersedes and replaces  */
/* components/modal.tsx, which is now unreferenced and safe to delete)       */
/* ------------------------------------------------------------------------ */

export type ModalProps = {
  /** Whether the modal is currently open. When false, nothing is rendered. */
  open: boolean;
  /** Called when the user requests to close the modal (Escape, backdrop click, close button). */
  onClose: () => void;
  /** Accessible title for the dialog. Rendered as the heading and wired to aria-labelledby. */
  title: string;
  /** Optional supporting description wired to aria-describedby. */
  description?: string;
  /** Modal body content. */
  children: React.ReactNode;
  /** Optional footer (e.g. action buttons). */
  footer?: React.ReactNode;
  /** Optional size hint for the dialog width. */
  size?: "sm" | "md" | "lg";
  /** When true, clicking the backdrop will not close the modal (useful for destructive flows). */
  disableBackdropClose?: boolean;
};

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

// Selector for elements that can receive keyboard focus inside the dialog.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Accessible modal dialog.
 *
 * Implements WCAG 2.4.3 (Focus Order) and 2.1.2 (No Keyboard Trap) requirements:
 *  - Moves focus into the dialog on open (close button by default, or first focusable element).
 *  - Traps Tab / Shift+Tab within the dialog while open.
 *  - Restores focus to the element that invoked the modal on close.
 *  - Closes on Escape and (optionally) backdrop click.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  disableBackdropClose = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Remember the element that had focus before the modal opened so we can restore it.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const reactId = useId();
  const titleId = `modal-title-${reactId}`;
  const descriptionId = `modal-desc-${reactId}`;

  const getFocusable = useCallback((): HTMLElement[] => {
    const container = dialogRef.current;
    if (!container) return [];
    return Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }, []);

  // On open: capture the trigger, move focus into the dialog, lock body scroll.
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

    // Focus the close button (or first focusable element) after paint.
    const raf = requestAnimationFrame(() => {
      const closeBtn = closeButtonRef.current;
      if (closeBtn) {
        closeBtn.focus();
      } else {
        const focusable = getFocusable();
        (focusable[0] ?? dialogRef.current)?.focus();
      }
    });

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    // Safety net for the focus trap: if focus ever lands outside the dialog
    // while it is open (programmatic focus, browser quirks), pull it back in
    // so Tab cannot reach the page behind the modal.
    const handleFocusIn = (event: FocusEvent) => {
      const container = dialogRef.current;
      if (!container) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      // Focus moving within this dialog (or one stacked above it) is fine.
      if (target?.closest('[role="dialog"]')) return;
      const focusable = getFocusable();
      (focusable[0] ?? container).focus();
    };
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("focusin", handleFocusIn);
      body.style.overflow = previousOverflow;
      // Restore focus to the invoking element on close.
      const toRestore = previouslyFocusedRef.current;
      if (
        toRestore &&
        typeof toRestore.focus === "function" &&
        toRestore.isConnected
      ) {
        toRestore.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [open, getFocusable]);

  // Keyboard handling: Escape to close, Tab to cycle focus within the dialog.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        // Nothing focusable but the dialog itself — keep focus contained.
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === dialogRef.current) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [getFocusable, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      // Backdrop click closes unless disabled.
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        // Prevent the mousedown from moving focus to <body> so the focus
        // trap holds even when the scrim is clicked.
        event.preventDefault();
        if (!disableBackdropClose) {
          onClose();
        }
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`relative z-10 w-full ${SIZE_CLASSES[size]} rounded-xl bg-white shadow-xl outline-none ring-1 ring-slate-200`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 -mt-1 rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-5 w-5"
            >
              <path
                d="M6 6l8 8M14 6l-8 8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* UpgradeModal (previously copy-pasted across three dashboard pages)        */
/* ------------------------------------------------------------------------ */

const PRO_BENEFITS = [
  "Track every driver on your authority, not just one",
  "Unlimited audit-ready DQF PDF exports",
  "Expiration alerts across all 18 driver qualification file items",
  "Document uploads attached to every DQF item",
];

export interface UpgradeModalProps {
  /** When false the modal renders nothing. Defaults to true. */
  open?: boolean;
  onClose: () => void;
  /** Short name of the gated feature, e.g. "audit-ready PDF exports". */
  feature?: string;
  /** Fully custom body copy; overrides the feature-based default. */
  description?: string;
}

export function UpgradeModal({
  open = true,
  onClose,
  feature,
  description,
}: UpgradeModalProps) {
  const body =
    description ??
    (feature
      ? `You have reached the free plan limit for ${feature}.`
      : "You have reached the limit of the free plan.");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade your RigFile plan"
      size="sm"
    >
      <p className="text-sm text-slate-600">
        {body} Upgrade to keep every driver qualification file complete and
        audit-ready:
      </p>
      <ul className="mt-4 space-y-2">
        {PRO_BENEFITS.map((benefit) => (
          <li
            key={benefit}
            className="flex items-start gap-2 text-sm text-slate-700"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.42.004L4.29 10.2a1 1 0 1 1 1.42-1.408l2.087 2.104 6.492-6.583a1 1 0 0 1 1.414-.023Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        One expired document can cost $1,270+ per DOT violation. A paid plan
        costs less than a single fine.
      </p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Maybe later
        </button>
        <Link href="/billing" className={btnPrimary} onClick={onClose}>
          View plans and upgrade
        </Link>
      </div>
    </Modal>
  );
}

export default UpgradeModal;
