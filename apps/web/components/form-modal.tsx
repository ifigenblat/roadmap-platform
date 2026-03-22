"use client";

import type { ReactNode } from "react";

/** Same shell as timeline / inline editors: overlay + scrollable slate card. */
export function FormModal({
  open,
  onClose,
  title,
  subtitle,
  titleId = "form-modal-title",
  children,
  maxWidthClass = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  titleId?: string;
  children: ReactNode;
  maxWidthClass?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className={`max-h-[min(90vh,720px)] w-full ${maxWidthClass} overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-4 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-100">
          {title}
        </h2>
        {subtitle != null && subtitle !== "" ? (
          <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export const modalFieldClass =
  "rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

export function ModalActions({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-700/80 pt-4 ${className}`}>
      {children}
    </div>
  );
}
