import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router';
import { AuthContext } from './AuthContext';

export default function ProtectedRoute() {
  const { user } = useContext(AuthContext);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}