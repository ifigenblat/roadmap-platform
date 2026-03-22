import { ApiWarning } from "../../components/api-warning";
import { AppLayout } from "../../components/layout";
import { loadJson } from "../../lib/api";
import { InitiativesClient } from "./initiatives-client";

export default async function Page() {
  const [initiatives, themes, sponsors] = await Promise.all([
    loadJson<any[]>("/api/initiatives"),
    loadJson<{ id: string; name: string }[]>("/api/themes"),
    loadJson<{ id: string; displayName: string }[]>("/api/business-sponsors"),
  ]);
  const apiOk = initiatives.ok && themes.ok && sponsors.ok;
  const warn =
    !initiatives.ok
      ? initiatives.message
      : !themes.ok
        ? themes.message
        : !sponsors.ok
          ? sponsors.message
          : "";

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-4">Initiatives</h1>
      {!apiOk && <ApiWarning message={warn} />}
      <InitiativesClient
        initial={initiatives.ok ? initiatives.data : []}
        themes={themes.ok ? themes.data : []}
        sponsors={sponsors.ok ? sponsors.data : []}
      />
    </AppLayout>
  );
}
