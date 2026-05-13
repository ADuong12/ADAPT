import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import AdminRoute from './auth/AdminRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import SetupPasswordPage from './pages/SetupPasswordPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup-password" element={<SetupPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/my-classes" element={<><div className="page-title">My Classes</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/lessons" element={<><div className="page-title">Lesson Library</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/knowledge" element={<><div className="page-title">Knowledge Bases</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/personalize" element={<><div className="page-title">Plan a Lesson</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/workspace/:adaptedId" element={<><div className="page-title">Workspace</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/settings" element={<><div className="page-title">Settings</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/print" element={<><div className="page-title">Print</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/admin" element={<AdminRoute />}>
                <Route index element={<><div className="page-title">Admin Dashboard</div><div className="page-subtitle">Coming soon</div></>} />
                <Route path="teachers" element={<><div className="page-title">Admin Teachers</div><div className="page-subtitle">Coming soon</div></>} />
                <Route path="classes" element={<><div className="page-title">Admin Classes</div><div className="page-subtitle">Coming soon</div></>} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}