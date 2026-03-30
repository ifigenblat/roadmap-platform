import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/protected-route.jsx";
import HomePage from "./pages/page";
import IntegrationsRedirectPage from "./pages/integrations/page";
import ImportsPage from "./pages/imports/page";
import InitiativesPage from "./pages/initiatives/page";
import InitiativeDetailPage from "./pages/initiatives/[id]/page";
import PhasesPage from "./pages/phases/page";
import RoadmapsPage from "./pages/roadmaps/page";
import RoadmapDetailPage from "./pages/roadmaps/[id]/page";
import RoadmapExecutivePage from "./pages/roadmaps/[id]/executive/page";
import RoadmapTimelinePage from "./pages/roadmaps/[id]/timeline/page";
import SponsorsPage from "./pages/sponsors/page";
import TeamsPage from "./pages/teams/page";
import TemplatesPage from "./pages/templates/page";
import ThemeDetailPage from "./pages/themes/[id]/page";
import ThemesPage from "./pages/themes/page";
import SettingsLayout from "./pages/settings/layout";
import AiSettingsPage from "./pages/settings/ai/page";
import IntegrationsSettingsPage from "./pages/settings/integrations/page";
import WorkspacesSettingsPage from "./pages/settings/workspaces/page";
import AccountPage from "./pages/account/page";
import LoginPage from "./pages/auth/login-page.jsx";
import RegisterPage from "./pages/auth/register-page.jsx";
import ResetPasswordPage from "./pages/auth/reset-password-page.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roadmaps"
        element={
          <ProtectedRoute>
            <RoadmapsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roadmaps/:id"
        element={
          <ProtectedRoute>
            <RoadmapDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roadmaps/:id/timeline"
        element={
          <ProtectedRoute>
            <RoadmapTimelinePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roadmaps/:id/executive"
        element={
          <ProtectedRoute>
            <RoadmapExecutivePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/initiatives"
        element={
          <ProtectedRoute>
            <InitiativesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/initiatives/:id"
        element={
          <ProtectedRoute>
            <InitiativeDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/themes"
        element={
          <ProtectedRoute>
            <ThemesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/themes/:id"
        element={
          <ProtectedRoute>
            <ThemeDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams"
        element={
          <ProtectedRoute>
            <TeamsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/phases"
        element={
          <ProtectedRoute>
            <PhasesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sponsors"
        element={
          <ProtectedRoute>
            <SponsorsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/imports"
        element={
          <ProtectedRoute>
            <ImportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates"
        element={
          <ProtectedRoute>
            <TemplatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsRedirectPage />
          </ProtectedRoute>
        }
      />
      {/* Account is only at /account (not nested under /settings). Legacy URLs redirect. */}
      <Route path="/settings/account" element={<Navigate to="/account" replace />} />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/settings/workspaces" replace />} />
        <Route path="workspaces" element={<WorkspacesSettingsPage />} />
        <Route path="integrations" element={<IntegrationsSettingsPage />} />
        <Route path="ai" element={<AiSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
