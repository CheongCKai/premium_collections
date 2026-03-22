import { useState } from 'react';
import './LoginPage.css';

export default function LoginPage({ onLoginSuccess, onClose }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', email: '', password: '', identifier: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetRequired, setResetRequired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [tempUser, setTempUser] = useState(null);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError('');
  };

  const togglePassword = () => setShowPassword(!showPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = tab === 'login'
      ? { identifier: form.identifier, password: form.password }
      : { username: form.username, email: form.email, password: form.password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      
      if (data.mustReset) {
        setTempUser(data.user);
        setResetRequired(true);
        sessionStorage.setItem('token', data.token); // Store token temporarily for password change
        setForm({ ...form, password: '' });
        return;
      }

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password.');
      
      sessionStorage.setItem('user', JSON.stringify(tempUser));
      onLoginSuccess(tempUser);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left decorative panel */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-brand">
            <span className="auth-brand-icon">🎁</span>
            <span className="auth-brand-name">Premium Collectable Collections</span>
          </div>
          <h2 className="auth-tagline">Discover the world's finest toy collections</h2>
          <div className="auth-features">
            <div className="auth-feature">🛒 Curated premium toys</div>
            <div className="auth-feature">⭐ Ratings &amp; reviews</div>
            <div className="auth-feature">🚀 Fast &amp; easy checkout</div>
            <div className="auth-feature">🔒 Secure accounts</div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-right">
        <div className="auth-card">
          {/* Tab toggle */}
          <div className="auth-tabs">
            <button
              className={`auth-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => { setTab('login'); setError(''); }}
            >
              Login
            </button>
            <button
              className={`auth-tab${tab === 'register' ? ' active' : ''}`}
              onClick={() => { setTab('register'); setError(''); }}
            >
              Register
            </button>
          </div>

          <h1 className="auth-title">
            {resetRequired ? 'Secure your account 🛡️' : tab === 'login' ? 'Welcome back 👋' : 'Create your account 🎉'}
          </h1>
          <p className="auth-subtitle">
            {resetRequired 
              ? 'A temporary reset was requested. Please set a new password.'
              : tab === 'login'
              ? 'Sign in to continue shopping'
              : 'Join thousands of toy collectors'}
          </p>

          {resetRequired ? (
            <form className="auth-form" onSubmit={handleResetPassword} noValidate>
              <div className="form-group password-group">
                <label htmlFor="new-password">New Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button" 
                    className="password-toggle-btn"
                    onClick={togglePassword}
                  >
                    {showPassword ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
              </div>
              {error && <div className="auth-error">⚠️ {error}</div>}
              <button className="auth-submit-btn" type="submit" disabled={loading}>
                {loading ? 'Updating…' : 'Set New Password'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {tab === 'register' && (
              <div className="form-group">
                <label htmlFor="auth-username">Username</label>
                <input
                  id="auth-username"
                  type="text"
                  placeholder="janesmith123"
                  value={form.username}
                  onChange={update('username')}
                  required
                  autoComplete="username"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-identifier">
                {tab === 'login' ? 'Username or Email Address' : 'Email Address'}
              </label>
              <input
                id="auth-identifier"
                type={tab === 'login' ? 'text' : 'email'}
                placeholder={tab === 'login' ? 'Username or email' : 'you@example.com'}
                value={tab === 'login' ? form.identifier : form.email}
                onChange={update(tab === 'login' ? 'identifier' : 'email')}
                required
                autoComplete={tab === 'login' ? 'username' : 'email'}
              />
            </div>

            <div className="form-group password-group">
              <label htmlFor="auth-password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={tab === 'register' ? 'Minimum 6 characters' : '••••••••'}
                  value={form.password}
                  onChange={update('password')}
                  required
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                />
                <button 
                  type="button" 
                  className="password-toggle-btn"
                  onClick={togglePassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>
            </div>

            {error && <div className="auth-error">⚠️ {error}</div>}

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          )}

          {!resetRequired && tab === 'login' && (
            <p className="auth-hint">
              Admin? Use <strong>admin@premium.com</strong> / <strong>admin123</strong><br/>
              Operator? Use <strong>admin1</strong> / <strong>admin123</strong>
            </p>
          )}

          {!resetRequired && (
            <p className="auth-switch">
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                className="auth-switch-btn"
                onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
              >
                {tab === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
