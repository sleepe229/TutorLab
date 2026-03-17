import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import ThemeToggle from '../ui/ThemeToggle';
import './Schedule.css';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.slice(0, 2);
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function Schedule({ tutorId, onLogout }) {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calDate, setCalDate] = useState(new Date());
  const [tooltip, setTooltip] = useState(null); // { day, x, y }
  const tooltipRef = useRef(null);

  useEffect(() => {
    studentApi.getStudentsByTutor(tutorId)
      .then(r => setStudents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tutorId]);

  // Flatten all lessons → Map<dateKey, lesson[]>
  const lessonsByDate = useMemo(() => {
    const map = {};
    students.forEach(student => {
      (student.lessonDates || []).forEach(dateStr => {
        let date = dateStr, time = '', note = '';
        if (dateStr.includes('|')) [date, time, note] = dateStr.split('|');
        if (!map[date]) map[date] = [];
        map[date].push({
          date,
          time: time || '',
          note: note || '',
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`.trim(),
          photoUrl: student.photoUrl,
        });
      });
    });
    return map;
  }, [students]);

  const year = calDate.getFullYear();
  const month = calDate.getMonth();

  const firstDow = (() => {
    let d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday-based
  })();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const getPhotoUrl = (url) => url ? (url.startsWith('/api/') ? `${API_BASE}${url}` : url) : null;

  // Close tooltip when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setTooltip(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDayClick = (day, lessons, e) => {
    if (!lessons || lessons.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ day, lessons, rect });
  };

  const renderDays = () => {
    const cells = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push(<div key={`e${i}`} className="sc-day sc-day--empty" />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = formatDateKey(year, month, d);
      const lessons = lessonsByDate[key] || [];
      const isToday = key === todayKey;
      const hasLessons = lessons.length > 0;

      cells.push(
        <div
          key={d}
          className={`sc-day${hasLessons ? ' sc-day--has-lesson' : ''}${isToday ? ' sc-day--today' : ''}`}
          onClick={hasLessons ? (e) => handleDayClick(d, lessons, e) : undefined}
        >
          <span className="sc-day__num">{d}</span>
          {hasLessons && (
            <div className="sc-day__lessons">
              {lessons.slice(0, 3).map((l, i) => (
                <div key={i} className="sc-day__chip">
                  {l.time && <span className="sc-day__time">{l.time}</span>}
                  <span className="sc-day__initials">{getInitials(l.studentName)}</span>
                </div>
              ))}
              {lessons.length > 3 && <div className="sc-day__more">+{lessons.length - 3}</div>}
            </div>
          )}
        </div>
      );
    }
    return cells;
  };

  // Compute tooltip position
  const tooltipStyle = useMemo(() => {
    if (!tooltip) return {};
    const r = tooltip.rect;
    return {
      top: r.bottom + window.scrollY + 8,
      left: Math.min(r.left + window.scrollX, window.innerWidth - 280),
    };
  }, [tooltip]);

  // Total/upcoming counts
  const totalLessons = Object.values(lessonsByDate).flat().length;
  const upcomingLessons = Object.entries(lessonsByDate)
    .filter(([d]) => d >= todayKey)
    .flatMap(([, ls]) => ls).length;

  return (
    <div className="schedule-container">
      <header className="top-nav" role="banner">
        <div className="top-nav-inner">
          <div className="top-nav-brand">
            <div className="brand-logo-mark">TL</div>
            <span className="brand-name">TutorLab</span>
          </div>
          <nav className="top-nav-links" aria-label="Навигация">
            <button className="nav-link nav-link-btn" onClick={() => navigate('/home')}>Ученики</button>
            <span className="nav-link active">Расписание</span>
          </nav>
          <div className="top-nav-actions">
            <ThemeToggle />
            {onLogout && (
              <button className="nav-icon-btn logout" onClick={onLogout} aria-label="Выйти" title="Выйти">
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

      <div className="schedule-content">
        <div className="schedule-stats">
          <div className="sc-stat">
            <span className="sc-stat__num">{upcomingLessons}</span>
            <span className="sc-stat__label">предстоящих</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat__num">{totalLessons}</span>
            <span className="sc-stat__label">всего уроков</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat__num">{students.length}</span>
            <span className="sc-stat__label">учеников</span>
          </div>
        </div>

        {loading ? (
          <div className="schedule-empty">Загрузка...</div>
        ) : (
          <div className="sc-calendar">
            {/* Calendar header */}
            <div className="sc-cal-header">
              <button className="sc-nav-btn" onClick={() => setCalDate(new Date(year, month - 1, 1))} aria-label="Предыдущий месяц">‹</button>
              <div className="sc-cal-title">
                <h2>{MONTH_NAMES[month]} {year}</h2>
                <button className="sc-today-btn" onClick={() => setCalDate(new Date())}>Сегодня</button>
              </div>
              <button className="sc-nav-btn" onClick={() => setCalDate(new Date(year, month + 1, 1))} aria-label="Следующий месяц">›</button>
            </div>

            {/* Weekday labels */}
            <div className="sc-weekdays">
              {WEEK_DAYS.map(w => <div key={w} className="sc-weekday">{w}</div>)}
            </div>

            {/* Grid */}
            <div className="sc-grid">
              {renderDays()}
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="sc-tooltip"
          style={tooltipStyle}
          ref={tooltipRef}
        >
          <div className="sc-tooltip__date">
            {new Date(year, month, tooltip.day).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {tooltip.lessons.map((l, i) => {
            const photo = getPhotoUrl(l.photoUrl);
            const isToday = formatDateKey(year, month, tooltip.day) === todayKey;
            return (
              <div key={i} className="sc-tooltip__lesson" onClick={() => { navigate(`/student/${l.studentId}`); setTooltip(null); }}>
                <div className="sc-tooltip__student">
                  {photo
                    ? <img src={photo} alt={l.studentName} className="sc-tooltip__avatar" />
                    : <div className="sc-tooltip__avatar-ph">{getInitials(l.studentName)}</div>
                  }
                  <div className="sc-tooltip__info">
                    <span className="sc-tooltip__name">{l.studentName}</span>
                    {l.time && <span className="sc-tooltip__time">{l.time}</span>}
                    {l.note && <span className="sc-tooltip__note">{l.note}</span>}
                  </div>
                </div>
                {isToday && (
                  <button
                    className="btn btn-primary sc-tooltip__start"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/live/teacher?studentId=${l.studentId}&studentName=${encodeURIComponent(l.studentName)}`);
                      setTooltip(null);
                    }}
                  >
                    Начать
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Schedule;
