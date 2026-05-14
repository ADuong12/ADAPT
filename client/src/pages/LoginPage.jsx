import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router';
import { AuthContext } from '../auth/AuthContext';
import { useApi, toast } from '../api/useApi';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const api = useApi();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.post('/auth/login', { email, password });
      await login(result);
      navigate('/dashboard');
    } catch (err) {
      toast('Login failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.post('/auth/register', { name, email, password });
      await login(result);
      navigate('/dashboard');
    } catch (err) {
      toast('Registration failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="logo">ADAPT</div>
        <div className="tag">AI lesson planning for K–12 CS teachers</div>

        {!isRegister ? (
          <>
            <div className="section-label">Sign in</div>
            <form onSubmit={handleLogin} autoComplete="off">
              <div className="form-row">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="form-row">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="at least 8 characters"
                  required
                />
              </div>
              <button className="btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '14px', textAlign: 'center' }}>
              Don't have an account?{' '}
              <Link to="#" onClick={(e) => { e.preventDefault(); setIsRegister(true); }} style={{ color: 'var(--accent)' }}>
                Sign up
              </Link>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', textAlign: 'center' }}>
              Need to set up your password?{' '}
              <Link to="/setup-password" style={{ color: 'var(--accent)' }}>
                Set up password
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="section-label">Create account</div>
            <form onSubmit={handleRegister} autoComplete="off">
              <div className="form-row">
                <label>Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="form-row">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="form-row">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="at least 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <button className="btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '14px', textAlign: 'center' }}>
              Already have an account?{' '}
              <Link to="#" onClick={(e) => { e.preventDefault(); setIsRegister(false); }} style={{ color: 'var(--accent)' }}>
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}