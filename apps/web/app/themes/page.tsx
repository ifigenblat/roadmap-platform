import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { ThemesClient } from "./themes-client";

export default async function Page() {
  const res = await loadJson<any[]>("/api/themes");
  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Strategic Themes</h1>
      {!res.ok && <ApiWarning message={res.message} />}
      <ThemesClient initial={res.ok ? res.data : []} />
    </AppLayout>
  );
}
