'use client';

/**
 * Building blocks shared by the simulator screens: button looks, a section that folds open and
 * shut, a dialog window and a small pop-up panel.
 */
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronIcon, CloseIcon } from './icons';

// =============================================================================================
// Button looks (Tailwind class lists)
// =============================================================================================

// Colours follow the website (src/app/globals.css): "ink" for text and dark surfaces, "brand"
// for the accent. Keyboard focus is the website's own ring (2px brand outline, set for every
// element in globals.css), so no button here draws a ring of its own.
const BUTTON_BASE =
  'inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-semibold transition ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

export const button = {
  /** white button with a thin border: the everyday button */
  plain: `${BUTTON_BASE} border border-slate-300 bg-white px-3 py-2 text-sm text-ink-700 hover:bg-slate-50 active:bg-slate-100`,
  /** the everyday button when it is the natural next step: tinted, so that it stands out */
  accent: `${BUTTON_BASE} border border-brand-500 bg-brand-50 px-3 py-2 text-sm text-brand-900 hover:bg-brand-100 active:bg-brand-200`,
  /** small square button that only shows an icon */
  icon: `${BUTTON_BASE} h-9 w-9 border border-slate-300 bg-white text-ink-700 hover:bg-slate-50 active:bg-slate-100`,
  /** the main action of a dialog */
  primary: `${BUTTON_BASE} bg-brand-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-brand-700 active:bg-brand-800`,
  /** text-only button inside toolbars */
  ghost: `${BUTTON_BASE} px-2.5 py-1.5 text-sm text-ink-600 hover:bg-slate-100 active:bg-slate-200`,
} as const;

/** A two-state button (pressed / not pressed), e.g. "show zones". */
export function toggleClass(on: boolean): string {
  return (
    `${BUTTON_BASE} gap-1.5 border px-2.5 py-1.5 text-xs ` +
    (on
      ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'
      : 'border-slate-300 bg-white text-ink-600 hover:bg-slate-50')
  );
}

// =============================================================================================
// Section that folds open and shut
// =============================================================================================

export interface SectionProps {
  title: string;
  /** short text shown on the right of the title, also while the section is closed */
  summary?: ReactNode;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}

export function Section({ title, summary, open, onToggle, children }: SectionProps) {
  const bodyId = useId();
  return (
    <section className="rounded-card border border-slate-200 bg-white shadow-sm">
      {/* (the website tightens the letters of its headings; this one is a row of small text, so it keeps normal spacing) */}
      <h2 className="tracking-normal">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onToggle(!open)}
          className="flex w-full items-center gap-2 rounded-card px-3 py-2.5 text-left text-sm font-semibold text-ink-800 hover:bg-slate-50"
        >
          <ChevronIcon open={open} className="h-4 w-4 shrink-0 text-ink-400" />
          <span className="shrink-0">{title}</span>
          {summary !== undefined && <span className="ml-auto min-w-0 truncate text-xs font-medium text-ink-500">{summary}</span>}
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="border-t border-slate-100 p-3">
          {children}
        </div>
      )}
    </section>
  );
}

// =============================================================================================
// Dialog window
// =============================================================================================

/** Everything the Tab key can stop at (used to keep Tab inside a window that covers the page). */
export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class of the window */
  widthClass?: string;
  /**
   * Where the window stands. 'center' (the default): in the middle of the screen. 'top': a
   * little below the top edge, for a window whose content changes height while it is open -
   * it then grows and shrinks at its lower edge only, and what is being read or typed in it
   * stays where it is.
   */
  align?: 'center' | 'top';
}

/** The frame around the window, and the tallest the window may be inside it. */
const MODAL_FRAME = {
  center: { frame: 'items-center p-3', panel: 'max-h-[calc(100dvh_-_1.5rem)]' },
  top: {
    // (on a phone the window starts right under the edge: every line of it counts there)
    frame: 'items-start px-3 pb-3 pt-[var(--mbot2-modal-top)] [--mbot2-modal-top:0.75rem] sm:[--mbot2-modal-top:max(0.75rem,6dvh)]',
    panel: 'max-h-[calc(100dvh_-_var(--mbot2-modal-top)_-_0.75rem)]',
  },
} as const;

/** A window on top of the page. Escape or a click beside it closes it; Tab stays inside. */
export function Modal({ title, onClose, children, widthClass = 'max-w-lg', align = 'center' }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // the focus is not in the window (the control that had it is gone): bring it back in,
      // instead of letting Tab wander through the page behind the window
      const outside = !active || !panel.contains(active);
      if (event.shiftKey && (active === first || active === panel || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-ink-950/55 ${MODAL_FRAME[align].frame}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex ${MODAL_FRAME[align].panel} w-full ${widthClass} flex-col rounded-card bg-white shadow-2xl outline-none`}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-bold text-ink-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`${button.icon} ml-auto h-8 w-8 border-transparent`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

// =============================================================================================
// Pop-up panel under a button
// =============================================================================================

/**
 * Open / closed state of a small panel that belongs to a button. A click anywhere else or the
 * Escape key closes it. Put `ref` on the element that wraps both the button and the panel.
 */
export function usePopover<T extends HTMLElement>(): { open: boolean; setOpen: (open: boolean) => void; ref: RefObject<T | null> } {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}
