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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⚡</span>
          <h1>TaskFlow</h1>
          <p className="auth-subtitle">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              className="form-input"
              value={form.username}
              onChange={set('username')}
              placeholder="Enter username"
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                className="form-input"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <div className="password-wrapper">
              <input
                id="auth-password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                value={form.password}
                onChange={set('password')}
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter password'}
                required
                minLength={mode === 'register' ? 6 : undefined}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
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

        <button className="auth-skip" onClick={handleSkip}>
          Continue without account →
        </button>
      </div>
    </div>
  );
}
