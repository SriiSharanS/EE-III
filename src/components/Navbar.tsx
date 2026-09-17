import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Assessments', to: '/assessment' },
  { label: 'Submissions', to: '/submissions' },
  { label: 'Progress', to: '/progress' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <div className="engine-status-pill" title="Java Execution Backend: Connected">
          <span className="status-indicator-dot"></span>
          <span className="engine-status-text">JDK 17 Online</span>
        </div>

        <button
          type="button"
          className="profile-button"
          aria-label="User Account"
          onClick={() => navigate('/assessment')}
        >
          <svg viewBox="0 0 24 24" className="profile-icon">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 20a9 9 0 0 1 18 0" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className={`mobile-burger ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
        >
          <span className="burger-bar"></span>
          <span className="burger-bar"></span>
          <span className="burger-bar"></span>
        </button>
      </div>
    </header>
  );
}
