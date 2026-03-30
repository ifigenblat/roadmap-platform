import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { modalFieldClass } from "./form-modal";

export type MultiSelectDropdownOption = {
  value: string;
  label: string;
  /** When present, a leading swatch is shown; null = no color (neutral slot). */
  swatchColor?: string | null;
  /** Extra text matched by searchable filter (e.g. color name); not shown as the main label. */
  searchText?: string;
};

/**
 * Single-line dropdown (button) summarizing selection; opens a list with checkboxes.
 * Not a tall &lt;select multiple&gt; list box.
 */
export function MultiSelectDropdown({
  id: idProp,
  options,
  value,
  onChange,
  disabled,
  placeholder = "Choose…",
  emptyText = "No options.",
  searchable = false,
  searchPlaceholder = "Search…",
  noMatchesText = "No matches.",
}: {
  id?: string;
  options: MultiSelectDropdownOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  /** When true, panel includes a filter box over option labels. */
  searchable?: boolean;
  searchPlaceholder?: string;
  noMatchesText?: string;
}) {
  const genId = useId();
  const btnId = idProp ?? genId;
  const listId = `${btnId}-list`;
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setSearchQuery("");
  }, [open]);

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPanelPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }, []);

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const summary = useMemo(() => {
    if (value.length === 0) return "";
    const labels = value.map((id) => labelByValue.get(id) ?? id);
    return labels.join(", ");
  }, [value, labelByValue]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = [o.label, o.searchText].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [options, searchQuery]);

  const toggle = useCallback(
    (id: string) => {
      if (value.includes(id)) onChange(value.filter((v) => v !== id));
      else onChange([...value, id]);
    },
    [onChange, value],
  );

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, reposition]);

  const listBody =
    options.length === 0 ? (
      <div className="px-3 py-2 text-xs text-slate-500">{emptyText}</div>
    ) : filteredOptions.length === 0 ? (
      <div className="px-3 py-2 text-xs text-slate-500">{noMatchesText}</div>
    ) : (
      filteredOptions.map((opt) => {
        const checked = value.includes(opt.value);
        const showSwatch = Object.hasOwn(opt, "swatchColor");
        return (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt.value)}
              onMouseDown={(e) => e.preventDefault()}
              className="h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
            />
            {showSwatch ? (
              <span
                className="h-3.5 w-3.5 shrink-0 rounded border border-slate-600 bg-slate-800/80"
                style={opt.swatchColor ? { backgroundColor: opt.swatchColor } : undefined}
                aria-hidden
              />
            ) : null}
            <span className="min-w-0 flex-1">{opt.label}</span>
          </label>
        );
      })
    );

  const panel =
    open && !disabled && mounted ? (
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        aria-multiselectable="true"
        className={`fixed z-[500] rounded-md border border-slate-600 bg-slate-950 shadow-xl ${
          searchable ? "flex max-h-72 flex-col overflow-hidden" : "max-h-60 overflow-y-auto py-1"
        }`}
        style={{
          top: panelPos.top,
          left: panelPos.left,
          width: Math.max(panelPos.width, searchable ? 240 : 200),
        }}
      >
        {searchable ? (
          <>
            <div className="shrink-0 border-b border-slate-700 p-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={`${modalFieldClass} w-full py-1.5 text-sm`}
                autoComplete="off"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">{listBody}</div>
          </>
        ) : (
          listBody
        )}
      </div>
    ) : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        id={btnId}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${modalFieldClass} flex w-full items-center justify-between gap-2 text-left`}
      >
        <span className={`min-w-0 flex-1 truncate ${summary ? "text-slate-100" : "text-slate-500"}`}>
          {summary || placeholder}
        </span>
        <span className="shrink-0 text-slate-400" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
