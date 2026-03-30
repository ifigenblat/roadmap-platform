"use client";

import { modalFieldClass } from "./form-modal";
import type { WorkspaceListItem } from "../lib/workspace-display";
import { resolveDefaultWorkspaceId, workspaceOptionLabel } from "../lib/workspace-display";

type Props = {
  label: string;
  value: string;
  onChange: (workspaceId: string) => void;
  workspaces: WorkspaceListItem[];
  /** When true, first option is empty string (omits workspaceId on save). */
  optional?: boolean;
  optionalOptionLabel?: string;
  disabled?: boolean;
};

const DEFAULT_OPTIONAL = "Not set (server default)";

export function WorkspaceSelectField({
  label,
  value,
  onChange,
  workspaces,
  optional = false,
  optionalOptionLabel = DEFAULT_OPTIONAL,
  disabled = false,
}: Props) {
  const safeValue = workspaces.some((w) => w.id === value)
    ? value
    : optional
      ? ""
      : resolveDefaultWorkspaceId(workspaces, value);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-400">{label}</span>
      {workspaces.length === 0 ? (
        <p className="rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
          No workspaces loaded. Create one under Settings → Workspaces, or the API will use its default workspace when
          you save.
        </p>
      ) : (
        <select
          className={modalFieldClass}
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={!optional}
        >
          {optional ? <option value="">{optionalOptionLabel}</option> : null}
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {workspaceOptionLabel(w)}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}
