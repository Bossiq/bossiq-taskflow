import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Eye, EyeOff, ArrowRight } from 'lucide-react';

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
  const [shaking, setShaking] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('taskflow-theme');
    return saved || 'dark';
  });
  const formRef = useRef(null);
  const rateLimitTimerRef = useRef(null);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('taskflow-theme', next);
  };

  // Countdown for rate limit
  useEffect(() => {
    if (rateLimitSeconds > 0) {
      rateLimitTimerRef.current = setTimeout(() => setRateLimitSeconds(s => s - 1), 1000);
      return () => clearTimeout(rateLimitTimerRef.current);
    }
  }, [rateLimitSeconds]);

  const set = (key) => (e) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    if (error) setError(''); // Clear error as user types
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rateLimitSeconds > 0) return; // Block while rate-limited
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
        credentials: 'include',
        body: JSON.stringify(body)
      });

      // Handle rate limiting (429)
      if (res.status === 429) {
        setRateLimitSeconds(60); // 60s cooldown
        setError('Too many attempts. Please wait before trying again.');
        triggerShake();
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch {
        setError('Server returned an unexpected response. Please try again.');
        triggerShake();
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        triggerShake();
        return;
      }

      // Store user metadata only (JWT is now safely handled by the browser cookie)
      localStorage.setItem('taskflow-user', JSON.stringify(data.user));
      onAuth(data.user);
    } catch {
      setError('Network error — is the server running?');
      triggerShake();
    } finally {
      setLoading(false); // ALWAYS reset loading, no matter what
    }
  };

  const handleSkip = async () => {
    try {
      const res = await fetch('/api/auth/guest', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        onAuth(data.user);
      } else {
        onAuth(null, null); // fallback to old behavior
      }
    } catch {
      onAuth(null, null); // fallback if server unreachable
    }
  };

  const handleTabSwitch = (newMode) => {
    setMode(newMode);
    setError('');
    setRateLimitSeconds(0);
    setForm({ username: '', email: '', password: '' });
  };

  return (
    <div className="auth-split-layout">
      {/* Left side: Premium Branding */}
      <div className="auth-branding">
        <div className="auth-branding-content">
          <div className="auth-branding-logo">
            <span>TaskFlow</span>
          </div>
          <h2 className="auth-branding-title">Manage your work.<br/>Master your time.</h2>
          <p className="auth-branding-desc">
            A production-ready Kanban board showcasing React, Express, SQLite, and modern web security — built as a portfolio project.
          </p>
          <div className="auth-branding-stats">
            <div className="stat"><strong>Full-Stack</strong> React + Express</div>
            <div className="stat"><strong>106</strong> Tests</div>
            <div className="stat"><strong>Zero</strong> Setup</div>
          </div>
        </div>
        <div className="auth-branding-bg-accent"></div>
      </div>

      {/* Right side: Form */}
      <div className="auth-form-container">
        <button
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="auth-form-wrapper">
          <div className="auth-header-mobile">
            TaskFlow
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

          <form onSubmit={handleSubmit} className={`auth-form ${shaking ? 'auth-shake' : ''}`} ref={formRef}>
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
                disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                />
                <label htmlFor="auth-password">Password</label>
                <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
                {rateLimitSeconds > 0 && (
                  <div className="auth-rate-limit-timer">
                    Try again in {rateLimitSeconds}s
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading || rateLimitSeconds > 0}>
              {loading ? (
                <span className="auth-spinner">Signing in...</span>
              ) : rateLimitSeconds > 0 ? (
                `Wait ${rateLimitSeconds}s`
              ) : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button className="btn btn-ghost auth-skip" onClick={handleSkip}>
            Continue as Guest <ArrowRight size={16} style={{display:'inline',verticalAlign:'middle',marginLeft:4}} />
          </button>
        </div>
      </div>
    </div>
  );
}
