import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

interface ProtectedRouteProps {
  roles: Role[];
  children: JSX.Element;
}

export function ProtectedRoute({ roles, children }: Readonly<ProtectedRouteProps>): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="centered">Checking session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
