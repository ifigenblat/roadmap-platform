"use client";

/** Lightweight sort control: inherits typography from parent `th`. */
export function SortableTh<K extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: K;
  activeKey: K;
  dir: "asc" | "desc";
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex w-full items-center gap-1 text-left text-inherit hover:text-slate-200"
      >
        <span>{label}</span>
        <span className="tabular-nums text-slate-500" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
