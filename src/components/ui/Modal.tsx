"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-6xl" };

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={[sizeClasses[size], "relative bg-white w-full rounded-xl shadow-xl"].join(" ")}
        style={{ display: "flex", flexDirection: "column", maxHeight: "90vh" }}
        role="dialog"
        aria-modal
        aria-labelledby="modal-title"
      >
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}
        >
          <h2 id="modal-title" className="font-serif text-lg font-semibold text-text">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-green transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div style={{ padding: "20px 24px", overflowY: "auto", flexShrink: 1 }}>{children}</div>
      </div>
    </div>
  );
}
