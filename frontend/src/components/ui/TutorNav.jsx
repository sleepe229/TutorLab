import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import './TutorNav.css';

/**
 * Unified tutor navigation bar.
 * Props:
 *   tutorId      — tutor's id (for unread badge)
 *   activePage   — 'home' | 'schedule' | 'student' | 'chat' | 'settings'
 *   onLogout     — optional logout handler
 *   breadcrumb   — optional { label } — shows "Ученики › label" instead of nav links
 *   extraActions — optional ReactNode rendered before ThemeToggle in actions area
 */
function TutorNav({ tutorId, activePage, onLogout, breadcrumb, extraActions }) {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount('TUTOR', tutorId, null);

  return (
    <header className="top-nav" role="banner">
      <div className="top-nav-inner">
        <div className="top-nav-brand" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
          <div className="brand-logo-mark">TL</div>
          <span className="brand-name">TutorLab</span>
        </div>

        {breadcrumb ? (
          <nav className="top-nav-breadcrumb" aria-label="Навигация">
            <button className="nav-link nav-link-btn" onClick={() => navigate('/home')}>Ученики</button>
            <span className="nav-breadcrumb-sep">›</span>
            <span className="nav-breadcrumb-current">{breadcrumb.label}</span>
          </nav>
        ) : (
          <nav className="top-nav-links" aria-label="Навигация">
            <button
              className={`nav-link nav-link-btn${activePage === 'home' ? ' active' : ''}`}
              onClick={() => navigate('/home')}
            >
              Ученики
            </button>
            <button
              className={`nav-link nav-link-btn${activePage === 'schedule' ? ' active' : ''}`}
              onClick={() => navigate('/schedule')}
            >
              Расписание
            </button>
          </nav>
        )}

        <div className="top-nav-actions">
          {extraActions}
          <ThemeToggle />
          <button
            className={`nav-icon-btn${activePage === 'chat' ? ' nav-icon-btn--active' : ''}`}
            onClick={() => navigate('/chat')}
            aria-label="Сообщения"
            title="Сообщения"
            style={{ position: 'relative' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {unreadCount > 0 && (
              <span className="nav-unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
          <button
            className={`nav-icon-btn${activePage === 'settings' ? ' nav-icon-btn--active' : ''}`}
            onClick={() => navigate('/settings')}
            aria-label="Настройки профиля"
            title="Настройки"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9 2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9 2.83-2.83"/>
            </svg>
          </button>
          {onLogout && (
            <button
              className="nav-icon-btn logout"
              onClick={onLogout}
              aria-label="Выйти из аккаунта"
              title="Выйти"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default TutorNav;
