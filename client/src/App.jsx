import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import AdminRoute from './auth/AdminRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import SetupPasswordPage from './pages/SetupPasswordPage';
import DashboardPage from './pages/DashboardPage';
import MyClassesPage from './pages/MyClassesPage';
import LessonLibraryPage from './pages/LessonLibraryPage';
import KBBrowserPage from './pages/KBBrowserPage';
import SettingsPage from './pages/SettingsPage';
import PrintPage from './pages/PrintPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminTeachersPage from './pages/AdminTeachersPage';
import AdminClassesPage from './pages/AdminClassesPage';

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
              <Route path="/my-classes" element={<MyClassesPage />} />
              <Route path="/lessons" element={<LessonLibraryPage />} />
              <Route path="/knowledge" element={<KBBrowserPage />} />
              <Route path="/personalize" element={<><div className="page-title">Plan a Lesson</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/workspace/:adaptedId" element={<><div className="page-title">Workspace</div><div className="page-subtitle">Coming soon</div></>} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/print" element={<PrintPage />} />
              <Route path="/admin" element={<AdminRoute />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="teachers" element={<AdminTeachersPage />} />
                <Route path="classes" element={<AdminClassesPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}