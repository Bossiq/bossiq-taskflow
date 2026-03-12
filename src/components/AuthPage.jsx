import React, { useState } from 'react';

const API = '/api';

/**
 * AuthPage — Login and Register form with toggle.
 * Glassmorphism card design matching the app's dark theme.
 */
export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { username: form.username, password: form.password }
        : { username: form.username, email: form.email, password: form.password };

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      // Store token and notify parent
      localStorage.setItem('taskflow-token', data.token);
      localStorage.setItem('taskflow-user', JSON.stringify(data.user));
      onAuth(data.user, data.token);
    } catch {
      setError('Network error — is the server running?');
    }
    setLoading(false);
  };

  const handleSkip = () => {
    onAuth(null, null);
  };

  const handleTabSwitch = (newMode) => {
    setMode(newMode);
    setError('');
    // Clear credentials to prevent accidental submissions with old data
    setForm({ username: '', email: '', password: '' });
  };

  return (
    <div className="auth-split-layout">
      {/* Left side: Premium Branding */}
      <div className="auth-branding">
        <div className="auth-branding-content">
          <div className="auth-branding-logo">
            <span className="auth-logo-icon">⚡</span>
            <span>TaskFlow</span>
          </div>
          <h2 className="auth-branding-title">Manage your work.<br/>Master your time.</h2>
          <p className="auth-branding-desc">
            Join thousands of professionals organizing projects with the most intuitive Kanban experience.
          </p>
          <div className="auth-branding-stats">
            <div className="stat"><strong>10k+</strong> Users</div>
            <div className="stat"><strong>99.9%</strong> Uptime</div>
            <div className="stat"><strong>0</strong> Setup</div>
          </div>
        </div>
        <div className="auth-branding-bg-accent"></div>
      </div>

      {/* Right side: Form */}
      <div className="auth-form-container">
        <div className="auth-form-wrapper">
          <div className="auth-header-mobile">
            <span className="auth-logo-icon">⚡</span> TaskFlow
          </div>
          
          <h1 className="auth-form-title">
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="auth-form-subtitle">
            {mode === 'login' ? 'Enter your details to access your board.' : 'Start organizing your tasks in seconds.'}
          </p>

          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('login')}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('register')}
            >
              Sign Up
            </button>
            <div className="auth-tab-indicator" style={{ left: mode === 'login' ? '0%' : '50%' }} />
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group floating">
              <input
                id="auth-username"
                className="form-input"
                value={form.username}
                onChange={set('username')}
                placeholder=" "
                required
                autoFocus
                autoComplete="username"
              />
              <label htmlFor="auth-username">Username</label>
            </div>

            {mode === 'register' && (
              <div className="form-group floating">
                <input
                  id="auth-email"
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={set('email')}
                  placeholder=" "
                  required
                  autoComplete="email"
                />
                <label htmlFor="auth-email">Email</label>
              </div>
            )}

            <div className="form-group floating">
              <div className="password-wrapper">
                <input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  value={form.password}
                  onChange={set('password')}
                  placeholder=" "
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <label htmlFor="auth-password">Password</label>
                <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                ⚠️ {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button className="btn btn-ghost auth-skip" onClick={handleSkip}>
            Continue as Guest →
          </button>
        </div>
      </div>
    </div>
  );
}
