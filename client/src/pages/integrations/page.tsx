import { Navigate } from "react-router-dom";

export default function IntegrationsRedirectPage() {
  return <Navigate to="/settings/integrations" replace />;
}
