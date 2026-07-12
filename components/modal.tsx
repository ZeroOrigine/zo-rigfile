"use client";

import { useCallback, useEffect, useId, useRef } from "react";

type ModalProps = {
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
 *
 * Shared by the dashboard, drivers, and audit-files pages so the focus behavior
 * only needs to be implemented once.
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
            <h2
              id={titleId}
              className="text-lg font-semibold text-slate-900"
            >
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

export default Modal;
