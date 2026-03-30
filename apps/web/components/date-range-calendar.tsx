"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

const pad = (n: number) => String(n).padStart(2, "0");
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
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

export function DateRangeCalendar({ from, to, onChange, onClose, anchorRef }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [rangeStart, setRangeStart] = useState<Date | null>(() => parseYmd(from));
  const [rangeEnd, setRangeEnd] = useState<Date | null>(() => parseYmd(to));

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 320;
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8));
    const top = Math.min(r.bottom + 8, window.innerHeight - 8);
    setPos({ top, left, width: w });
  }, [anchorRef]);

  useEffect(() => {
    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [reposition]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, onClose]);

  const matrix = useMemo(() => monthMatrix(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  function applyRange(a: Date, b: Date) {
    const s = a <= b ? a : b;
    const e = a <= b ? b : a;
    setRangeStart(s);
    setRangeEnd(e);
    setDraftFrom(toYmd(s));
    setDraftTo(toYmd(e));
    onChange(toYmd(s), toYmd(e));
  }

  function onPickDay(d: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
      setDraftFrom(toYmd(d));
      setDraftTo(toYmd(d));
      onChange(toYmd(d), toYmd(d));
      return;
    }
    applyRange(rangeStart, d);
  }

  function dayClass(d: Date): string {
    const base =
      "flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors";
    const t0 = startOfDay(d).getTime();
    const rs = rangeStart ? startOfDay(rangeStart).getTime() : null;
    const re = rangeEnd ? startOfDay(rangeEnd).getTime() : null;
    let inRange = false;
    if (rs != null && re != null) {
      const lo = Math.min(rs, re);
      const hi = Math.max(rs, re);
      inRange = t0 >= lo && t0 <= hi;
    } else if (rs != null) {
      inRange = t0 === rs;
    }
    const isToday = toYmd(d) === toYmd(today);
    if (inRange) return `${base} bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-500/40`;
    if (isToday) return `${base} text-slate-100 ring-1 ring-slate-600`;
    return `${base} text-slate-200 hover:bg-slate-800`;
  }

  function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  const portal =
    typeof document !== "undefined" ? document.body : null;
  if (!portal) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-[200] rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-2xl shadow-black/50"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      role="dialog"
      aria-label="Choose date range"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => setViewYear((y) => y - 1)}
            aria-label="Previous year"
          >
            «
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              if (viewMonth === 0) {
                setViewMonth(11);
                setViewYear((y) => y - 1);
              } else setViewMonth((m) => m - 1);
            }}
            aria-label="Previous month"
          >
            ‹
          </button>
        </div>
        <div className="text-sm font-semibold text-slate-100">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              if (viewMonth === 11) {
                setViewMonth(0);
                setViewYear((y) => y + 1);
              } else setViewMonth((m) => m + 1);
            }}
            aria-label="Next month"
          >
            ›
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => setViewYear((y) => y + 1)}
            aria-label="Next year"
          >
            »
          </button>
        </div>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {matrix.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1">
            {row.map((cell, ci) =>
              cell ? (
                <button key={ci} type="button" className={dayClass(cell)} onClick={() => onPickDay(cell)}>
                  {cell.getDate()}
                </button>
              ) : (
                <div key={ci} />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Start
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              value={draftFrom}
              onChange={(e) => {
                const v = e.target.value;
                setDraftFrom(v);
                const p = parseYmd(v);
                if (p) {
                  setRangeStart(p);
                  if (rangeEnd && p > rangeEnd) {
                    setRangeEnd(p);
                    setDraftTo(v);
                    onChange(v, v);
                  } else if (rangeEnd) onChange(v, draftTo);
                  else onChange(v, v);
                }
              }}
            />
          </label>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            End
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              value={draftTo}
              onChange={(e) => {
                const v = e.target.value;
                setDraftTo(v);
                const p = parseYmd(v);
                if (p) {
                  setRangeEnd(p);
                  if (rangeStart && p < rangeStart) {
                    setRangeStart(p);
                    setDraftFrom(v);
                    onChange(v, v);
                  } else if (rangeStart) onChange(draftFrom, v);
                  else onChange(v, v);
                }
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              setDraftFrom("");
              setDraftTo("");
              setRangeStart(null);
              setRangeEnd(null);
              onChange("", "");
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
