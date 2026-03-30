import { AppLayout } from "../../components/layout";
import { AccountSettingsClient } from "./account-client";

export default function AccountPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <AccountSettingsClient />
      </div>
    </AppLayout>
  );
}
