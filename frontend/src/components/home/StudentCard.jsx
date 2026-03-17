import React, { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../../config.js';
import './StudentCard.css';

function StudentCard({ student, onClick, onDelete, onToggleFavorite, tutorId, onStartLesson }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  const getPhotoUrl = () => {
    if (!student.photoUrl) return null;
    if (student.photoUrl.startsWith('/api/')) return `${API_BASE}${student.photoUrl}`;
    return student.photoUrl;
  };

  const photoUrl = getPhotoUrl();

  // Lesson stats
  const lessonCount = student.lessonDates?.length || 0;
  const materialCount = student.materialUrls?.length || 0;

  // Parse date from "YYYY-MM-DD|HH:MM|note" strings
  const parseLessonDate = (d) => new Date(d.includes('|') ? d.split('|')[0] : d);

  // Upcoming lesson
  const now = new Date();
  const upcomingLesson = student.lessonDates
    ?.map(parseLessonDate)
    .filter(d => !isNaN(d) && d > now)
    .sort((a, b) => a - b)[0] || null;

  // Last past lesson
  const lastLesson = student.lessonDates
    ?.map(parseLessonDate)
    .filter(d => !isNaN(d) && d <= now)
    .sort((a, b) => b - a)[0] || null;

  const formatDate = (date) => {
    if (!date) return null;
    const days = Math.floor((now - date) / 86400000);
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Вчера';
    if (days < 7) return `${days} дн. назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const formatUpcoming = (date) => {
    if (!date) return null;
    const days = Math.floor((date - now) / 86400000);
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Завтра';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleMenuClick = (e) => { e.stopPropagation(); setShowMenu(!showMenu); };
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm('Удалить ученика?')) { onDelete(student.id); setShowMenu(false); }
  };
  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    onToggleFavorite(student.id);
    setShowMenu(false);
  };
  const handleCardClick = (e) => {
    if (!menuRef.current?.contains(e.target)) onClick();
  };
  const handleStartLesson = (e) => {
    e.stopPropagation();
    const fullName = `${student.firstName} ${student.lastName}`.trim();
    onStartLesson?.(student.id, fullName);
  };

  const initials = `${student.firstName?.charAt(0) || ''}${student.lastName?.charAt(0) || ''}`.toUpperCase();

  return (
    <article
      className={`student-card ${student.isFavorite ? 'student-card--favorite' : ''}`}
      onClick={handleCardClick}
      role="listitem"
      aria-label={`${student.firstName} ${student.lastName}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Avatar */}
      <div className="sc-avatar">
        {photoUrl ? (
          <img src={photoUrl} alt={`${student.firstName} ${student.lastName}`} />
        ) : (
          <div className="sc-avatar-initials">{initials}</div>
        )}
        {upcomingLesson && (
          <div className="sc-upcoming-dot" title={`Урок: ${formatUpcoming(upcomingLesson)}`} />
        )}
      </div>

      {/* Main info */}
      <div className="sc-info">
        <div className="sc-info-top">
          <div>
            <h3 className="sc-name" title={`${student.firstName} ${student.lastName}`}>{student.firstName} {student.lastName}</h3>
            <p className="sc-age">{student.age} лет</p>
          </div>

          <div className="sc-top-right">
            {student.isFavorite && (
              <div className="sc-fav-badge" title="Избранный">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
            )}
            <div className="sc-menu" ref={menuRef}>
              <button className="sc-menu-btn" onClick={handleMenuClick} aria-label="Меню студента">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                </svg>
              </button>
              {showMenu && (
                <div className="sc-menu-dropdown" role="menu">
                  <button className="sc-menu-item" onClick={handleToggleFavorite} role="menuitem">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={student.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {student.isFavorite ? 'Убрать из избранных' : 'Добавить в избранные'}
                  </button>
                  <button className="sc-menu-item sc-menu-item--danger" onClick={handleDelete} role="menuitem">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="sc-stats">
          <span className="sc-stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {lessonCount} {lessonCount === 1 ? 'урок' : lessonCount < 5 ? 'урока' : 'уроков'}
          </span>
          {materialCount > 0 && (
            <span className="sc-stat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {materialCount} {materialCount === 1 ? 'материал' : 'материала'}
            </span>
          )}
          {upcomingLesson ? (
            <span className="sc-stat sc-stat--upcoming">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {formatUpcoming(upcomingLesson)}
            </span>
          ) : lastLesson ? (
            <span className="sc-stat sc-stat--muted">
              Был {formatDate(lastLesson)}
            </span>
          ) : (
            <span className="sc-stat sc-stat--muted">Уроков нет</span>
          )}
        </div>

        {/* Actions */}
        <div className="sc-actions">
          <button className="sc-btn sc-btn--primary" onClick={handleStartLesson} aria-label="Начать урок">
            Начать урок →
          </button>
        </div>
      </div>
    </article>
  );
}

export default StudentCard;
