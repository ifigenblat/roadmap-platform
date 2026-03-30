"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const pad = (n: number) => String(n).padStart(2, "0");

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim().slice(0, 10));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return d;
}

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const inputWrap =
  "flex min-w-0 flex-1 items-center gap-1 rounded-md border border-slate-700 bg-slate-950 pl-2 pr-1 py-1";
const nativeInput =
  "min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none [color-scheme:dark]";

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  required?: boolean;
};

export function DatePickerField({
  id,
  label,
  value,
  onChange,
  disabled,
  className = "",
  required,
}: Props) {
  const genId = useId();
  const inputId = id ?? genId;
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const base = parseYmd(value) ?? new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());

  useEffect(() => {
    const d = parseYmd(value);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const reposition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 280;
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8));
    const top = Math.min(r.bottom + 6, window.innerHeight - 8);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (wrapRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const matrix = useMemo(() => monthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const portal = typeof document !== "undefined" ? document.body : null;

  return (
    <div className={className}>
      {label ? (
        <span className="mb-1 block text-xs text-slate-400">{label}</span>
      ) : null}
      <div ref={wrapRef} className={inputWrap}>
        <input
          id={inputId}
          type="date"
          disabled={disabled}
          required={required}
          value={value.slice(0, 10)}
          onChange={(e) => onChange(e.target.value)}
          className={nativeInput}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          aria-label="Open calendar"
          title="Calendar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && portal
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[250] w-[280px] rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl"
              style={{ top: pos.top, left: pos.left }}
              role="dialog"
              aria-label="Pick date"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    if (viewMonth === 0) {
                      setViewMonth(11);
                      setViewYear((y) => y - 1);
                    } else setViewMonth((m) => m - 1);
                  }}
                >
                  ‹
                </button>
                <span className="text-sm font-medium text-slate-100">{monthLabel}</span>
                <button
                  type="button"
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    if (viewMonth === 11) {
                      setViewMonth(0);
                      setViewYear((y) => y + 1);
                    } else setViewMonth((m) => m + 1);
                  }}
                >
                  ›
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase text-slate-500">
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="space-y-0.5">
                {matrix.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-7 gap-0.5">
                    {row.map((cell, ci) =>
                      cell ? (
                        <button
                          key={ci}
                          type="button"
                          className={`h-8 rounded text-xs ${
                            toYmd(cell) === value.slice(0, 10)
                              ? "bg-indigo-600 text-white"
                              : "text-slate-200 hover:bg-slate-800"
                          }`}
                          onClick={() => {
                            onChange(toYmd(cell));
                            setOpen(false);
                          }}
                        >
                          {cell.getDate()}
                        </button>
                      ) : (
                        <div key={ci} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>,
            portal,
          )
        : null}
    </div>
  );
}
