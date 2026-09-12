import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Assessments', to: '/assessment' },
  { label: 'Submissions', to: '/submissions' },
  { label: 'Progress', to: '/progress' },
];

export default function Navbar() {
  return (
    <nav className="topbar">
      <div className="brand-wrap">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" className="brand-icon" aria-label="CodeAssess AI">
            <path d="M8 9L3 12l5 3M16 9l5 3-5 3M13 4l-2 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="brand-name">CodeAssess AI</span>
      </div>

      <div className="nav-links">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'nav-link active-nav' : 'nav-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="profile-wrap">
        <button className="profile-button" aria-label="Open profile">
          <svg viewBox="0 0 24 24" className="profile-icon">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 20a9 9 0 0 1 18 0" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
