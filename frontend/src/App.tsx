import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MilestonesPage } from "./pages/MilestonesPage";
import { ProjectsPage } from "./pages/ProjectsPage";
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
        <Route path="milestones" element={<MilestonesPage />} />
        <Route path="projects/:projectId/milestones" element={<MilestonesPage />} />
        <Route path="workflow" element={<WorkflowPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
