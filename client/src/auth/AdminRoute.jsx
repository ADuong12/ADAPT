import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router';
import { AuthContext } from './AuthContext';

export default function AdminRoute() {
  const { user } = useContext(AuthContext);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}