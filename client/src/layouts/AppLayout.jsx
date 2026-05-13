import { useContext } from 'react';
import { NavLink, Link, Outlet } from 'react-router';
import { AuthContext } from '../auth/AuthContext';

export default function AppLayout() {
  const { user, logout } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="logo">ADAPT</div>
        <NavLink to="/dashboard" className={({ isActive }) => 'nav-item' + (isActive ? ' nav-active' : '')}>Dashboard</NavLink>
        <NavLink to="/my-classes" className={({ isActive }) => 'nav-item' + (isActive ? ' nav-active' : '')}>My Classes</NavLink>
        <NavLink to="/lessons" className={({ isActive }) => 'nav-item' + (isActive ? ' nav-active' : '')}>Lesson Library</NavLink>
        <NavLink to="/knowledge" className={({ isActive }) => 'nav-item' + (isActive ? ' nav-active' : '')}>Knowledge Bases</NavLink>
        <NavLink to="/personalize" className={({ isActive }) => 'nav-item' + (isActive ? ' nav-active' : '')}>Plan a Lesson</NavLink>
        {isAdmin && (
          <>
            <div className="nav-section">Admin</div>
            <NavLink to="/admin" end className={({ isActive }) => 'nav-item' + (isActive ? ' nav-active' : '')}>Overview</NavLink>
            <NavLink to="/admin/teachers" className={({ isActive }) => 'nav-item' + (isActive ? ' nav-active' : '')}>Teachers</NavLink>
            <NavLink to="/admin/classes" className={({ isActive }) => 'nav-item' + (isActive ? ' nav-active' : '')}>Classes</NavLink>
          </>
        )}
        <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text2)' }}>
          <div style={{ marginBottom: '6px' }}>{user?.name}</div>
          <Link to="/settings" style={{ color: 'var(--text2)', fontSize: '11px', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>⚙ Settings</Link>
          <button onClick={logout} style={{ color: 'var(--text2)', fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Log out</button>
        </div>
      </div>
      <div className="main">
        <Outlet />
      </div>
      <div id="toast" className="toast"></div>
    </div>
  );
}