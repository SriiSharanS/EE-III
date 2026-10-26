import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authenticatePortalUser } from '../auth';

interface LoginLocationState {
  from?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    try {
      await authenticatePortalUser(normalizedEmail, password, remember);
      const state = location.state as LoginLocationState | null;
      navigate(state?.from ?? '/assessment', { replace: true });
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Unable to authenticate user.';
      setError(message);
    }
  };

  return (
    <main className="login-page">
      <div className="login-orb login-orb-one" aria-hidden="true" />
      <div className="login-orb login-orb-two" aria-hidden="true" />

      <section className="login-layout">
        <div className="login-story appear appear--soft" style={{ '--d': '0.1s' } as React.CSSProperties}>
          <div className="login-brand" aria-label="CodeAssess AI">
            <div className="brand-mark login-brand-mark">
              <svg viewBox="0 0 24 24" className="brand-icon" aria-hidden="true">
                <g transform="rotate(-30 12 12)">
                  <circle cx="7.3" cy="3.2" r="1.45" fill="currentColor" />
                  <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" fill="currentColor" />
                  <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" fill="currentColor" />
                  <circle cx="16.7" cy="20.8" r="1.45" fill="currentColor" />
                </g>
              </svg>
            </div>
            <span className="brand-name">
              CodeAssess<span className="logo-suffix">.ai</span>
            </span>
          </div>

          <div className="login-story-copy">
            <span className="login-eyebrow">Candidate portal</span>
            <h1>Build confidence.<br /><em>Prove your craft.</em></h1>
            <p>
              Enter a focused Java assessment workspace with live compiler diagnostics,
              custom input, and immediate execution feedback.
            </p>
          </div>

          <div className="login-proof" aria-label="Portal features">
            <span><i />JDK 17 execution</span>
            <span><i />Real compiler output</span>
            <span><i />Secure session access</span>
          </div>
        </div>

        <div className="login-card-wrap appear appear--scale" style={{ '--d': '0.2s' } as React.CSSProperties}>
          <form className="login-card" onSubmit={handleSubmit} noValidate>
            <div className="login-card-heading">
              <span className="login-card-kicker">Welcome back</span>
              <h2>Sign in to your portal</h2>
              <p>Use your registered email to continue your assessment.</p>
            </div>

            <div className="login-field">
              <label htmlFor="portal-email">Email address</label>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6.5h18v11H3zM3.8 7.3 12 13l8.2-5.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  id="portal-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError('');
                  }}
                  aria-invalid={Boolean(error)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="portal-password">Password</label>
                <button
                  type="button"
                  className="login-text-button"
                  onClick={() => setError('Contact your assessment administrator to reset your password.')}
                >
                  Forgot password?
                </button>
              </div>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <input
                  id="portal-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError('');
                  }}
                  aria-invalid={Boolean(error)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <label className="remember-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>Keep me signed in on this device</span>
            </label>

            {error && <div className="login-error" role="alert">{error}</div>}

            <button type="submit" className="login-submit">
              <span>Enter assessment portal</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <p className="login-terms">
              Demo login: <strong>mockuser@codeassess.com</strong> / <strong>mockpass123</strong>
            </p>
            <p className="login-terms">
              By continuing, you agree to the assessment integrity and privacy policies.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
