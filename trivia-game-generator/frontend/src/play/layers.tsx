// Layers over the play screen's board: sheets (players, log, legend, info), modal cards
// (question, answer, game over) and floating notices that stay above them.

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

/**
 * A native modal <dialog>, open while mounted: focus moves into it, the board behind is inert,
 * Esc and a tap on the backdrop close it. `variant` "sheet" slides up from the bottom on phones
 * (a centered panel on wide screens) and can be swiped down, with a close button; "card" is a
 * centered card whose own buttons close it.
 */
export function Layer({
  title,
  onClose,
  variant = "sheet",
  className = "",
  children,
  labelledBy,
}: {
  title?: React.ReactNode;
  /** No onClose: only the content can close it (e.g. a question that must be answered). */
  onClose?: () => void;
  variant?: "sheet" | "card";
  className?: string;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const unmounting = useRef(false);

  useEffect(() => {
    const d = ref.current!;
    unmounting.current = false;
    if (!d.open) d.showModal();
    return () => {
      unmounting.current = true;
      d.close();
    };
  }, []);

  const swipe = onClose && variant === "sheet";
  return (
    <dialog
      ref={ref}
      className={`layer ${variant} ${className}`}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : typeof title === "string" ? title : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      onClose={(e) => {
        // Closed by the browser (e.g. Esc pressed twice): tell the owner, or reopen if it must stay.
        // A close queued by an earlier cleanup (StrictMode remounts) arrives while it's open again.
        if (unmounting.current || e.currentTarget.open) return;
        if (onClose) onClose();
        else e.currentTarget.showModal();
      }}
    >
      <div className="layer-box" style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}>
        {(title || swipe) && (
          <header
            className="layer-head"
            onPointerDown={(e) => {
              if (!swipe || (e.target as HTMLElement).closest("button")) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              dragStart.current = e.clientY;
            }}
            onPointerMove={(e) => dragStart.current !== null && setDrag(Math.max(0, e.clientY - dragStart.current))}
            onPointerUp={() => {
              if (dragStart.current === null) return;
              dragStart.current = null;
              if (drag > 70) onClose?.();
              setDrag(0);
            }}
            onPointerCancel={() => {
              dragStart.current = null;
              setDrag(0);
            }}
          >
            {swipe && <span className="grabber" aria-hidden="true" />}
            {title && <h2>{title}</h2>}
            {swipe && (
              <button className="icon-btn ghost" onClick={onClose} aria-label="Close">
                <Icon name="close" size={20} />
              </button>
            )}
          </header>
        )}
        <div className="layer-body">{children}</div>
      </div>
    </dialog>
  );
}

/**
 * Floats above everything, open dialogs included (a manual popover joins the top layer).
 * Re-shown whenever `bump` changes, so the newest notice is the topmost.
 */
export function Floating({ className, bump, children, role = "status" }: { className: string; bump?: unknown; children: React.ReactNode; role?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
    } catch {
      // no popover support: it stays an ordinary fixed element
    }
  }, [bump]);
  return (
    <div ref={ref} popover="manual" className={`floating ${className}`} role={role} aria-live="polite">
      {children}
    </div>
  );
}
