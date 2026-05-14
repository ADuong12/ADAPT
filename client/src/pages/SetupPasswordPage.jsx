import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router';
import { AuthContext } from '../auth/AuthContext';
import { useApi, toast } from '../api/useApi';

export default function SetupPasswordPage() {
  const [email, setEmail] = useState('');
  const [requiresSetup, setRequiresSetup] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useContext(AuthContext);
  const api = useApi();
  const navigate = useNavigate();

  const handleCheck = async (e) => {
    e.preventDefault();
    setChecking(true);
    try {
      const result = await api.get('/api/auth/setup-request?email=' + encodeURIComponent(email));
      setRequiresSetup(result.requires_setup);
      if (!result.requires_setup) {
        toast('Your account is already set up. Please log in.', 'success');
      }
    } catch (err) {
      toast('Error checking account: ' + err.message, 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast('Password must be at least 8 characters', 'error');
      return;
    }
    if (password !== confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.put('/api/auth/setup-password', { email, password });
      await login(result);
      navigate('/dashboard');
    } catch (err) {
      toast('Setup failed: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="logo">ADAPT</div>
        <div className="tag">Set your password to get started</div>

        {requiresSetup === null ? (
          <>
            <div className="section-label">Check your account</div>
            <form onSubmit={handleCheck}>
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
              <button className="btn-primary" type="submit" style={{ width: '100%' }} disabled={checking}>
                {checking ? 'Checking…' : 'Check'}
              </button>
            </form>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '14px', textAlign: 'center' }}>
              <Link to="/login" style={{ color: 'var(--accent)' }}>Back to sign in</Link>
            </div>
          </>
        ) : requiresSetup ? (
          <>
            <div className="section-label">Set your password</div>
            <form onSubmit={handleSetup}>
              <div className="form-row">
                <label>New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="at least 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <div className="form-row">
                <label>Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                />
              </div>
              <button className="btn-primary" type="submit" style={{ width: '100%' }} disabled={submitting}>
                {submitting ? 'Setting up…' : 'Set Password'}
              </button>
            </form>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '14px', textAlign: 'center' }}>
              <Link to="/login" style={{ color: 'var(--accent)' }}>Back to sign in</Link>
            </div>
          </>
        ) : (
          <>
            <div className="section-label">Account ready</div>
            <p style={{ fontSize: '13px', color: 'var(--text2)', margin: '12px 0' }}>
              Your account is already set up. Please log in.
            </p>
            <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textAlign: 'center', width: '100%', textDecoration: 'none' }}>
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}