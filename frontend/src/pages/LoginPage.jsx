import { useState } from 'react';
import './LoginPage.css';

export default function LoginPage({ onLoginSuccess, onClose }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = tab === 'login'
      ? { email: form.email, password: form.password }
      : { name: form.name, email: form.email, password: form.password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
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
            {tab === 'login' ? 'Welcome back 👋' : 'Create your account 🎉'}
          </h1>
          <p className="auth-subtitle">
            {tab === 'login'
              ? 'Sign in to continue shopping'
              : 'Join thousands of toy collectors'}
          </p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {tab === 'register' && (
              <div className="form-group">
                <label htmlFor="auth-name">Full Name</label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={update('name')}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update('email')}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                placeholder={tab === 'register' ? 'Minimum 6 characters' : '••••••••'}
                value={form.password}
                onChange={update('password')}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && <div className="auth-error">⚠️ {error}</div>}

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {tab === 'login' && (
            <p className="auth-hint">
              Admin? Use <strong>admin@premium.com</strong> / <strong>admin123</strong>
            </p>
          )}

          <p className="auth-switch">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              className="auth-switch-btn"
              onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
            >
              {tab === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
