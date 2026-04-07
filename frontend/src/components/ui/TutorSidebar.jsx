import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import './TutorSidebar.css';

const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Ученики',
    path: '/home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: 'schedule',
    label: 'Расписание',
    path: '/schedule',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Сообщения',
    path: '/chat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Настройки',
    path: '/settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9 2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9 2.83-2.83"/>
      </svg>
    ),
  },
];

function TutorSidebar({ tutorId, activePage, onLogout, breadcrumb, extraActions }) {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount('TUTOR', tutorId, null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile top bar */}
      <header className="sidebar-mobile-bar">
        <div className="sidebar-mobile-logo" onClick={() => navigate('/home')}>
          <div className="sidebar-logo-mark">TL</div>
          <span className="sidebar-brand-name">TutorLab</span>
        </div>
        <div className="sidebar-mobile-actions">
          <ThemeToggle />
          <button
            className="sidebar-hamburger"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Меню"
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`tutor-sidebar${mobileOpen ? ' tutor-sidebar--open' : ''}`}>
        {/* Logo */}
        <button className="sidebar-logo-wrap" onClick={() => handleNav('/home')}>
          <div className="sidebar-logo-mark">TL</div>
          <span className="sidebar-brand-name">TutorLab</span>
        </button>

        {/* Breadcrumb if given */}
        {breadcrumb && (
          <div className="sidebar-breadcrumb">
            <button className="sidebar-breadcrumb-back" onClick={() => handleNav('/home')}>
              ← Ученики
            </button>
            <span className="sidebar-breadcrumb-current">{breadcrumb.label}</span>
          </div>
        )}

        {/* Extra page-level actions (e.g. from StudentDetail) */}
        {extraActions && (
          <div className="sidebar-extra-actions">{extraActions}</div>
        )}

        {/* Nav links */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item${activePage === item.id ? ' sidebar-nav-item--active' : ''}`}
              onClick={() => handleNav(item.path)}
            >
              <span className="sidebar-nav-icon">
                {item.icon}
                {item.id === 'chat' && unreadCount > 0 && (
                  <span className="sidebar-nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <ThemeToggle />
          {onLogout && (
            <button
              className="sidebar-footer-btn"
              onClick={onLogout}
              aria-label="Выйти"
              title="Выйти"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Выйти</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

export default TutorSidebar;
