import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';
import { clearPortalSession, getPortalSession } from '../auth';

const navItems = [
  { label: 'Dashboard', to: '/assessment' },
  { label: 'Practice Lab', to: '/assessment' },
  { label: 'Portal', to: '/login' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [javaVersion, setJavaVersion] = useState('Java compiler');
  const session = getPortalSession();

  useEffect(() => {
    const controller = new AbortController();

    fetch(apiUrl('/api/health'), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed');
        return response.json() as Promise<{ java_available: boolean; java_version?: string }>;
      })
      .then((health) => {
        setEngineStatus(health.java_available ? 'online' : 'offline');
        setJavaVersion(health.java_version || 'Java compiler');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setEngineStatus('offline');
        setJavaVersion('Compiler unavailable');
      });

    return () => controller.abort();
  }, []);

  const handleLogout = () => {
    clearPortalSession();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      {/* Brand / Logo */}
      <div
        className="brand-wrap appear appear--scale"
        style={{ '--d': '0.08s' } as React.CSSProperties}
        onClick={() => navigate('/assessment')}
        role="button"
        tabIndex={0}
      >
        <div className="brand-mark">
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

      {/* Primary Pill Navigation */}
      <nav className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Primary">
        {navItems.map((item, idx) => (
          <NavLink
            key={item.label}
            to={item.to}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `nav-pill appear ${idx % 2 === 0 ? 'appear--scale' : 'appear--soft'} ${
                isActive ? 'active-nav' : ''
              }`
            }
            style={{ '--d': `${0.16 + idx * 0.1}s` } as React.CSSProperties}
          >
            <span className="nav-pill-text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Right Controls & Profile */}
      <div
        className="profile-wrap appear appear--scale"
        style={{ '--d': '0.36s' } as React.CSSProperties}
      >
        <div
          className={`engine-status-pill engine-status-${engineStatus}`}
          title={engineStatus === 'online' ? `${javaVersion}: Connected` : 'Java execution backend is unavailable'}
        >
          <span className="status-indicator-dot"></span>
          <span className="engine-status-text">
            {engineStatus === 'checking'
              ? 'Checking compiler'
              : engineStatus === 'online'
                ? `${javaVersion} Online`
                : 'Compiler offline'}
          </span>
        </div>

        <button
          type="button"
          className="profile-button"
          aria-label={session ? `Signed in as ${session.name}` : 'User account'}
          title={session?.email}
          onClick={() => navigate('/assessment')}
        >
          <svg viewBox="0 0 24 24" className="profile-icon">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 20a9 9 0 0 1 18 0" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M14.5 8l4 4-4 4M9 12h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className={`mobile-burger ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>
  );
}
