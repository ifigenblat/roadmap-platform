"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../lib/api";
import { workspaceLabelById } from "../lib/workspace-display";

type Workspace = { id: string; name: string; slug: string };

export function WorkspaceHeaderBadge() {
  const searchParams = useSearchParams();
  const workspaceParam = searchParams.get("workspace")?.trim() ?? "";
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<Workspace[]>("/api/workspaces")
      .then((data) => {
        if (!cancelled) setWorkspaces(data);
      })
      .catch(() => {
        if (!cancelled) setWorkspaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = useMemo(() => {
    if (workspaces === null) return "Loading…";
    if (workspaces.length === 0) return "None";
    if (workspaceParam) {
      return workspaceLabelById(workspaceParam, workspaces);
    }
    const def = workspaces.find((x) => x.slug === "default") ?? workspaces[0];
    return def.name;
  }, [workspaces, workspaceParam]);

  return (
    <div
      className="hidden max-w-[min(18rem,50vw)] shrink-0 truncate rounded-full bg-indigo-600 px-3 py-1 text-sm text-white sm:block"
      title={label}
    >
      Workspace: {label}
    </div>
  );
}
