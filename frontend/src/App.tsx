import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ActionsPage } from "./pages/ActionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DependenciesPage } from "./pages/DependenciesPage";
import { LoginPage } from "./pages/LoginPage";
import { MilestonesPage } from "./pages/MilestonesPage";
import { ProjectDetailsPage } from "./pages/ProjectDetailsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RisksIssuesPage } from "./pages/RisksIssuesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { WorkflowPage } from "./pages/WorkflowPage";

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute roles={["admin", "manager", "engineering", "approver", "viewer"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
        <Route path="milestones" element={<MilestonesPage />} />
        <Route path="projects/:projectId/milestones" element={<MilestonesPage />} />
        <Route path="dependencies" element={<DependenciesPage />} />
        <Route path="risks" element={<RisksIssuesPage />} />
        <Route path="actions" element={<ActionsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="workflow" element={<WorkflowPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
