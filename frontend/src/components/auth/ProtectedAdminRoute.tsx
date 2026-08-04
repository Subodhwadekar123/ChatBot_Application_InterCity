/**
 * Protected Admin Route
 * Guard component that only allows admin users through.
 * Redirects regular users to the user login, and unauthenticated users to the admin login.
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../../store/useStore';

const ProtectedAdminRoute: React.FC = () => {
  const { user, token } = useStore();

  // Not authenticated at all
  if (!token || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Authenticated but not an admin
  if (!user.is_admin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedAdminRoute;
