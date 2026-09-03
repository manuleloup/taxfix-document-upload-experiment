"use client";

import { useEffect, useRef } from "react";

// Approximation of the DS Dialog: a Backdrop plus a Card-shaped panel.
// The real component's exact spec wasn't recoverable from the Storybook
// bundle, so this follows the Card conventions we do have (surface3, radius
// lg, elevation) and standard dialog behaviour — Escape to close, focus
// moved into the panel, backdrop click to dismiss.
export default function Dialog({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children?: React.ReactNode;
  actions: React.ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tf-backdrop" onClick={onClose}>
      <div
        className="tf-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="t-h5 tf-dialog-title">{title}</h2>
        {children && <div className="tf-dialog-body">{children}</div>}
        <div className="tf-dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
