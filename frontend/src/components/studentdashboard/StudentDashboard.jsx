import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentApi, studentAccountApi, liveApi, progressApi } from '../../services/api';
import { connectToTutorUpdates } from '../../services/wsClient';
import { API_BASE } from '../../config.js';
import { parseLocalDate } from '../../utils/date';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import ThemeToggle from '../ui/ThemeToggle';
import './StudentDashboard.css';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getCalInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.slice(0, 2);
}

function StudentDashboard({ studentAccountId, onLogout }) {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'schedule' | 'progress'
  const [sessionHistory, setSessionHistory] = useState([]);
  const [progressNotes, setProgressNotes] = useState({});
  const [liveSession, setLiveSession] = useState(null);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [calDate, setCalDate] = useState(new Date());
  const [calTooltip, setCalTooltip] = useState(null); // { day, lessons, rect }
  const [settingsForm, setSettingsForm] = useState({ firstName: '', lastName: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const avatarInputRef = useRef(null);
  const wsLiveRef = useRef(null);
  const calTooltipRef = useRef(null);

  const token = localStorage.getItem('studentToken');
  const firstName = localStorage.getItem('studentFirstName') || '';
  const lastName = localStorage.getItem('studentLastName') || '';
  const unreadCount = useUnreadCount('STUDENT', studentAccountId, token);

  useEffect(() => { loadData(); }, [studentAccountId]);

  useEffect(() => {
    return () => wsLiveRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (calTooltipRef.current && !calTooltipRef.current.contains(e.target)) {
        setCalTooltip(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await studentAccountApi.getMe(token);
      const acc = meRes.data;
      setEmail(acc.email || '');
      if (acc.photoUrl) setPhotoUrl(acc.photoUrl);

      const ids = acc.linkedStudentIds || [];
      const loaded = await Promise.all(
        ids.map(id =>
          studentApi.getStudentPublic(id)
            .then(r => r.data)
            .catch(() => null)
        )
      );
      const valid = loaded.filter(Boolean);
      setProfiles(valid);
      subscribeToLive(valid);

      try {
        const histRes = await studentAccountApi.getHistory(token);
        setSessionHistory(histRes.data || []);
      } catch { /* history unavailable */ }

      const notesMap = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const nr = await progressApi.getNotes(id, token);
          notesMap[id] = nr.data || [];
        } catch { notesMap[id] = []; }
      }));
      setProgressNotes(notesMap);
    } catch {
      toast.error('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToLive = (profileList) => {
    const tutorIds = [...new Set(profileList.map(p => p.tutorId).filter(Boolean))];
    if (tutorIds.length === 0) return;

    const getTutorName = (tutorId) =>
      profileList.find(p => p.tutorId === tutorId)?.tutorName || 'Преподаватель';

    tutorIds.forEach(async (tutorId) => {
      try {
        const res = await liveApi.getSessionByTutor(tutorId, token);
        setLiveSession({ sessionId: res.data.sessionId, tutorName: getTutorName(tutorId), tutorId });
      } catch { /* 404 = no active session */ }
    });

    wsLiveRef.current?.disconnect();
    wsLiveRef.current = connectToTutorUpdates(tutorIds, {
      onLiveSession: (tutorId, data) => {
        if (data.active) {
          setLiveSession({ sessionId: data.sessionId, tutorName: getTutorName(tutorId), tutorId });
        } else {
          setLiveSession(prev => prev?.tutorId === tutorId ? null : prev);
        }
      },
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const parseLessons = (student) =>
    (student?.lessonDates || []).map(d => {
      if (d.includes('|')) {
        const [date, time, note] = d.split('|');
        return { date, time: time || '', note: note || '', tutorName: student.tutorName, tutorId: student.tutorId, studentId: student.id };
      }
      return { date: d, time: '', note: '', tutorName: student.tutorName, tutorId: student.tutorId, studentId: student.id };
    });

  const formatDate = (dateStr) => {
    const d = parseLocalDate(dateStr);
    if (d.toDateString() === today.toDateString()) return 'Сегодня';
    if (d.toDateString() === tomorrow.toDateString()) return 'Завтра';
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getMaterials = (student, date) =>
    (student?.lessonMaterials?.[date] || []).map(url => ({
      url: url.startsWith('/api/') ? `${API_BASE}${url}` : url,
      name: decodeURIComponent(url.split('/').pop()),
    }));

  const displayName = firstName + (lastName ? ` ${lastName}` : '');
  const initials = (firstName?.charAt(0) || '') + (lastName?.charAt(0) || '');

  const allUpcoming = profiles
    .flatMap(s => parseLessons(s).filter(l => parseLocalDate(l.date) >= today))
    .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  const allPast = profiles
    .flatMap(s => parseLessons(s).filter(l => parseLocalDate(l.date) < today))
    .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));

  const totalSessions = sessionHistory.reduce((sum, g) => sum + (g.sessions?.length || 0), 0);

  // Analytics computations for Progress tab
  const allNotes = useMemo(() => Object.values(progressNotes).flat(), [progressNotes]);
  const avgRating = useMemo(() =>
    allNotes.length > 0 ? (allNotes.reduce((s, n) => s + (n.rating || 0), 0) / allNotes.length).toFixed(1) : null
  , [allNotes]);
  const totalStudyTime = useMemo(() =>
    sessionHistory.reduce((sum, g) => sum + (g.sessions || []).reduce((s, sess) => s + (sess.durationMinutes || 0), 0), 0)
  , [sessionHistory]);
  const skillFreq = useMemo(() => {
    const freq = {};
    allNotes.forEach(n => (n.skillTags || []).forEach(tag => { freq[tag] = (freq[tag] || 0) + 1; }));
    return freq;
  }, [allNotes]);
  const maxSkillFreq = Math.max(1, ...Object.values(skillFreq));
  const topSkill = Object.entries(skillFreq).sort((a, b) => b[1] - a[1])[0]?.[0];
  const ratingHistory = useMemo(() =>
    allNotes.filter(n => n.date && n.rating).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10)
  , [allNotes]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await studentApi.uploadPhoto(file);
      if (url) {
        await studentAccountApi.updatePhoto(token, url);
        setPhotoUrl(url);
        toast.success('Аватар обновлён');
      }
    } catch {
      toast.error('Не удалось загрузить фото');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSettingsSave = async () => {
    const { firstName: fn, lastName: ln, currentPassword, newPassword, confirmPassword } = settingsForm;
    if (newPassword && newPassword !== confirmPassword) {
      setSettingsMsg({ type: 'error', text: 'Новые пароли не совпадают' });
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setSettingsMsg({ type: 'error', text: 'Пароль должен быть не менее 8 символов' });
      return;
    }
    setSettingsLoading(true);
    setSettingsMsg({ type: '', text: '' });
    try {
      const payload = {};
      if (fn.trim()) payload.firstName = fn.trim();
      if (ln !== undefined) payload.lastName = ln.trim();
      if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }
      const res = await studentAccountApi.updateMe(token, payload);
      if (payload.firstName) localStorage.setItem('studentFirstName', res.data.firstName);
      if (payload.lastName !== undefined) localStorage.setItem('studentLastName', res.data.lastName || '');
      setSettingsMsg({ type: 'success', text: 'Данные сохранены' });
      setSettingsForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      const msg = err.response?.data?.error || 'Ошибка при сохранении';
      setSettingsMsg({ type: 'error', text: msg });
    } finally {
      setSettingsLoading(false);
    }
  };

  // Calendar data
  const lessonsByDate = useMemo(() => {
    const map = {};
    profiles.forEach(profile => {
      (profile.lessonDates || []).forEach(dateStr => {
        let date = dateStr, time = '', note = '';
        if (dateStr.includes('|')) [date, time, note] = dateStr.split('|');
        if (!map[date]) map[date] = [];
        map[date].push({ date, time, note, tutorName: profile.tutorName, tutorId: profile.tutorId, studentId: profile.id });
      });
    });
    return map;
  }, [profiles]);

  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const calFirstDow = (() => { let d = new Date(calYear, calMonth, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const calTooltipStyle = useMemo(() => {
    if (!calTooltip) return {};
    const r = calTooltip.rect;
    return {
      top: r.bottom + window.scrollY + 8,
      left: Math.min(r.left + window.scrollX, window.innerWidth - 280),
    };
  }, [calTooltip]);

  const handleCalDayClick = (day, lessons, e) => {
    if (!lessons || lessons.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCalTooltip(prev => prev?.day === day && prev?.rect === rect ? null : { day, lessons, rect });
  };

  const renderCalDays = () => {
    const cells = [];
    for (let i = 0; i < calFirstDow; i++) {
      cells.push(<div key={`e${i}`} className="sd-cal-day sd-cal-day--empty" />);
    }
    for (let d = 1; d <= calDaysInMonth; d++) {
      const key = formatDateKey(calYear, calMonth, d);
      const lessons = lessonsByDate[key] || [];
      const isToday = key === todayKey;
      const hasLessons = lessons.length > 0;
      cells.push(
        <div
          key={d}
          className={`sd-cal-day${hasLessons ? ' sd-cal-day--has-lesson' : ''}${isToday ? ' sd-cal-day--today' : ''}`}
          onClick={hasLessons ? (e) => handleCalDayClick(d, lessons, e) : undefined}
        >
          <span className="sd-cal-day__num">{d}</span>
          {hasLessons && (
            <div className="sd-cal-day__chips">
              {lessons.slice(0, 3).map((l, i) => (
                <div key={i} className="sd-cal-chip">
                  {l.time && <span className="sd-cal-chip__time">{l.time}</span>}
                  <span className="sd-cal-chip__initials">{getCalInitials(l.tutorName || '')}</span>
                </div>
              ))}
              {lessons.length > 3 && <div className="sd-cal-more">+{lessons.length - 3}</div>}
            </div>
          )}
        </div>
      );
    }
    return cells;
  };

  const renderLessonCard = (l, i, studentProfile) => {
    const isToday = parseLocalDate(l.date).toDateString() === today.toDateString();
    const hasLive = isToday && liveSession && l.tutorId === liveSession.tutorId;
    const mats = studentProfile ? getMaterials(studentProfile, l.date) : [];
    return (
      <div key={i} className={`sd-lesson-card${isToday ? ' sd-today' : ''}`}>
        <div className="sd-lesson-meta">
          <span className="sd-lesson-date">{formatDate(l.date)}</span>
          {l.time && <span className="sd-lesson-time">{l.time}</span>}
          {l.tutorName && <span className="sd-lesson-tutor">{l.tutorName}</span>}
        </div>
        {l.note && <p className="sd-lesson-note">{l.note}</p>}
        {mats.length > 0 && (
          <ul className="sd-mats">
            {mats.map((m, j) => (
              <li key={j}><a href={m.url} target="_blank" rel="noopener noreferrer" download>📄 {m.name}</a></li>
            ))}
          </ul>
        )}
        {hasLive && (
          <a href={`/live/student/${liveSession.sessionId}`} className="btn btn-primary sd-join-btn">
            Подключиться к уроку
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="sd-container">
      <header className="sd-nav">
        <div className="sd-nav-inner">
          <button className="sd-brand sd-brand-btn" onClick={() => setActiveTab('home')} type="button">
            <div className="sd-logo">TL</div>
            <span className="sd-brand-name">TutorLab</span>
          </button>

          <nav className="sd-nav-tabs">
            {[
              { key: 'home', label: 'Кабинет' },
              { key: 'schedule', label: 'Расписание' },
              { key: 'progress', label: 'Прогресс' },
              { key: 'settings', label: 'Настройки' },
            ].map(t => (
              <button
                key={t.key}
                className={`sd-tab${activeTab === t.key ? ' sd-tab--active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="sd-nav-actions">
            <button className="nav-link nav-link-btn" onClick={() => navigate('/tutors')}>Репетиторы</button>
            <ThemeToggle />
            <button
              className="nav-icon-btn"
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
            <button className="nav-icon-btn logout" onClick={onLogout} title="Выйти" aria-label="Выйти">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {liveSession && (
        <div className="sd-live-banner">
          <span className="sd-live-dot" />
          <span className="sd-live-text">
            <strong>{liveSession.tutorName}</strong> начал урок
          </span>
          <a href={`/live/student/${liveSession.sessionId}`} className="btn btn-primary sd-live-join">
            Подключиться
          </a>
          <button className="sd-live-dismiss" onClick={() => setLiveSession(null)} aria-label="Закрыть">✕</button>
        </div>
      )}

      <div className="sd-body">
        {loading ? (
          <div className="sd-loading">Загрузка...</div>
        ) : activeTab === 'home' ? (
          /* ── Home tab ── */
          <>
            {/* Account card */}
            <div className="sd-account-card">
              {photoUrl
                ? <img src={photoUrl.startsWith('/api/') ? `${API_BASE}${photoUrl}` : photoUrl} alt={displayName} className="sd-avatar-photo sd-avatar-lg" />
                : <div className="sd-avatar-placeholder sd-avatar-lg">{initials || '?'}</div>
              }
              <div className="sd-account-info">
                <p className="sd-profile-name">{displayName || 'Студент'}</p>
                {email && <p className="sd-profile-email">{email}</p>}
              </div>
            </div>

            {/* Stats strip */}
            <div className="sd-stats">
              <div className="sd-stat">
                <span>{allUpcoming.length}</span>
                предстоящих
              </div>
              <div className="sd-stat">
                <span>{profiles.length}</span>
                {profiles.length === 1 ? 'репетитор' : profiles.length < 5 ? 'репетитора' : 'репетиторов'}
              </div>
              <div className="sd-stat">
                <span>{totalSessions}</span>
                проведено
              </div>
            </div>

            {profiles.length === 0 ? (
              <div className="sd-link-section">
                <h2 className="sd-section-title">Нет активных занятий</h2>
                <p className="sd-link-hint">
                  Попросите репетитора прислать вам ссылку-приглашение, чтобы появиться здесь.
                </p>
              </div>
            ) : (
              <>
                {/* Nearest upcoming lessons (max 5) */}
                <section className="sd-section">
                  <h2 className="sd-section-title">Ближайшие занятия</h2>
                  {allUpcoming.length === 0 ? (
                    <p className="sd-empty">Нет запланированных занятий</p>
                  ) : (
                    <div className="sd-lessons">
                      {allUpcoming.slice(0, 5).map((l, i) => {
                        const studentProfile = profiles.find(p => p.id === l.studentId);
                        return renderLessonCard(l, i, studentProfile);
                      })}
                      {allUpcoming.length > 5 && (
                        <button className="sd-show-more" onClick={() => setActiveTab('schedule')}>
                          Ещё {allUpcoming.length - 5} занятий → Расписание
                        </button>
                      )}
                    </div>
                  )}
                </section>

                {/* My tutors */}
                <section className="sd-section">
                  <h2 className="sd-section-title">Мои репетиторы</h2>
                  <div className="sd-tutors-list">
                    {profiles.map(p => {
                      const isLive = liveSession?.tutorId === p.tutorId;
                      const upcoming = parseLessons(p).filter(l => parseLocalDate(l.date) >= today);
                      return (
                        <div key={p.id} className={`sd-tutor-chip${isLive ? ' sd-tutor-chip--live' : ''}`} onClick={() => navigate(`/tutor/${p.tutorId}`)} style={{ cursor: 'pointer' }}>
                          <div className="sd-tutor-chip-avatar">
                            {p.tutorName?.charAt(0) || '?'}
                          </div>
                          <div className="sd-tutor-chip-info">
                            <p className="sd-tutor-chip-name">{p.tutorName || 'Репетитор'}</p>
                            {upcoming.length > 0 && (
                              <p className="sd-tutor-chip-meta">
                                Следующий урок: {formatDate(upcoming[0].date)}
                                {upcoming[0].time ? `, ${upcoming[0].time}` : ''}
                              </p>
                            )}
                          </div>
                          {isLive && (
                            <a href={`/live/student/${liveSession.sessionId}`} className="sd-tutor-live-badge">
                              <span className="sd-live-dot" />
                              Идёт урок
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

          </>
        ) : activeTab === 'settings' ? (
          /* ── Settings tab ── */
          <div className="sd-settings-page">
            <div className="sd-greeting">
              <h1>Настройки</h1>
              <p className="sd-greeting-sub">Управление профилем и безопасностью</p>
            </div>

            {/* Avatar section */}
            <div className="sd-settings-card">
              <h2>Фото профиля</h2>
              <div className="sd-settings-avatar-wrap">
                {photoUrl
                  ? <img src={photoUrl.startsWith('/api/') ? `${API_BASE}${photoUrl}` : photoUrl} alt="Аватар" className="sd-settings-avatar-img" />
                  : <div className="sd-settings-avatar-ph">{initials || '?'}</div>
                }
                <button
                  className="sd-settings-avatar-btn"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  type="button"
                >
                  {avatarUploading ? 'Загрузка...' : 'Изменить фото'}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              </div>
            </div>

            {/* Name / password form */}
            <div className="sd-settings-card">
              <h2>Личные данные</h2>
              <div className="sd-settings-form sd-settings-form--page">
                <div className="sd-settings-row">
                  <label className="sd-settings-label">Имя</label>
                  <input
                    className="sd-settings-input"
                    type="text"
                    placeholder={firstName || 'Имя'}
                    value={settingsForm.firstName}
                    onChange={e => setSettingsForm(p => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div className="sd-settings-row">
                  <label className="sd-settings-label">Фамилия</label>
                  <input
                    className="sd-settings-input"
                    type="text"
                    placeholder={lastName || 'Фамилия'}
                    value={settingsForm.lastName}
                    onChange={e => setSettingsForm(p => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
                {email && (
                  <div className="sd-settings-row">
                    <label className="sd-settings-label">Email</label>
                    <input className="sd-settings-input" type="text" value={email} readOnly style={{ opacity: 0.6 }} />
                  </div>
                )}
                <div className="sd-settings-divider">Изменить пароль</div>
                <div className="sd-settings-row">
                  <label className="sd-settings-label">Текущий пароль</label>
                  <input
                    className="sd-settings-input"
                    type="password"
                    placeholder="••••••••"
                    value={settingsForm.currentPassword}
                    onChange={e => setSettingsForm(p => ({ ...p, currentPassword: e.target.value }))}
                  />
                </div>
                <div className="sd-settings-row">
                  <label className="sd-settings-label">Новый пароль</label>
                  <input
                    className="sd-settings-input"
                    type="password"
                    placeholder="Минимум 8 символов"
                    value={settingsForm.newPassword}
                    onChange={e => setSettingsForm(p => ({ ...p, newPassword: e.target.value }))}
                  />
                </div>
                <div className="sd-settings-row">
                  <label className="sd-settings-label">Повторите пароль</label>
                  <input
                    className="sd-settings-input"
                    type="password"
                    placeholder="••••••••"
                    value={settingsForm.confirmPassword}
                    onChange={e => setSettingsForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  />
                </div>
                {settingsMsg.text && (
                  <p className={`sd-settings-msg sd-settings-msg--${settingsMsg.type}`}>{settingsMsg.text}</p>
                )}
                <button
                  className="btn btn-primary sd-settings-save"
                  onClick={handleSettingsSave}
                  disabled={settingsLoading}
                  type="button"
                >
                  {settingsLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'schedule' ? (
          /* ── Schedule tab — Calendar ── */
          <div className="sd-schedule">
            {/* Calendar */}
            <div className="sd-calendar">
              <div className="sd-cal-header">
                <button className="sd-cal-nav" onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))} aria-label="Предыдущий месяц">‹</button>
                <div className="sd-cal-title">
                  <span>{MONTH_NAMES[calMonth]} {calYear}</span>
                  <button className="sd-cal-today-btn" onClick={() => setCalDate(new Date())}>Сегодня</button>
                </div>
                <button className="sd-cal-nav" onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))} aria-label="Следующий месяц">›</button>
              </div>
              <div className="sd-cal-weekdays">
                {WEEK_DAYS.map(w => <div key={w} className="sd-cal-weekday">{w}</div>)}
              </div>
              <div className="sd-cal-grid">
                {renderCalDays()}
              </div>
            </div>

            {/* Past lessons — collapsed */}
            {allPast.length > 0 && (
              <section className="sd-section" style={{ marginTop: '24px' }}>
                <button
                  className="sd-past-toggle"
                  onClick={() => setPastExpanded(v => !v)}
                >
                  {pastExpanded
                    ? `Скрыть историю занятий ▲`
                    : `История занятий (${allPast.length}) ▼`}
                </button>
                {pastExpanded && (
                  <div className="sd-lessons sd-past" style={{ marginTop: '12px' }}>
                    {allPast.slice(0, 30).map((l, i) => {
                      const studentProfile = profiles.find(p => p.id === l.studentId);
                      const mats = studentProfile ? getMaterials(studentProfile, l.date) : [];
                      return (
                        <div key={i} className="sd-lesson-card sd-past-card">
                          <div className="sd-lesson-meta">
                            <span className="sd-lesson-date">{formatDate(l.date)}</span>
                            {l.time && <span className="sd-lesson-time">{l.time}</span>}
                            {l.tutorName && <span className="sd-lesson-tutor">{l.tutorName}</span>}
                          </div>
                          {l.note && <p className="sd-lesson-note">{l.note}</p>}
                          {mats.length > 0 && (
                            <ul className="sd-mats">
                              {mats.map((m, j) => (
                                <li key={j}><a href={m.url} target="_blank" rel="noopener noreferrer" download>📄 {m.name}</a></li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          /* ── Progress tab — Analytics ── */
          <div className="sd-schedule">
            <div className="sd-greeting">
              <h1>Прогресс</h1>
              <p className="sd-greeting-sub">Аналитика, конспекты и заметки репетитора</p>
            </div>

            {/* Analytics stats row */}
            <div className="sd-analytics-stats">
              <div className="sd-analytics-stat">
                <span className="sd-analytics-val">{totalSessions}</span>
                <span className="sd-analytics-label">уроков</span>
              </div>
              <div className="sd-analytics-stat">
                <span className="sd-analytics-val">{avgRating !== null ? `${avgRating}★` : '—'}</span>
                <span className="sd-analytics-label">средняя оценка</span>
              </div>
              <div className="sd-analytics-stat">
                <span className="sd-analytics-val">{totalStudyTime > 0 ? `${Math.round(totalStudyTime / 60)} ч` : '—'}</span>
                <span className="sd-analytics-label">учебного времени</span>
              </div>
              <div className="sd-analytics-stat">
                <span className="sd-analytics-val sd-analytics-val--skill">{topSkill || '—'}</span>
                <span className="sd-analytics-label">топ навык</span>
              </div>
            </div>

            {/* Rating dynamics */}
            {ratingHistory.length > 1 && (
              <section className="sd-section">
                <h2 className="sd-subsection-title">Динамика оценок</h2>
                <div className="sd-rating-chart">
                  {ratingHistory.map((n, i) => (
                    <div key={i} className="sd-rating-bar-wrap">
                      <div className="sd-rating-bar" style={{ height: `${(n.rating / 5) * 100}%` }} title={`${n.rating}★`} />
                      <span className="sd-rating-bar-label">{n.rating}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Skill map */}
            {Object.keys(skillFreq).length > 0 && (
              <section className="sd-section">
                <h2 className="sd-subsection-title">Навыки</h2>
                <div className="sd-skill-map">
                  {Object.entries(skillFreq).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
                    <span
                      key={tag}
                      className="sd-skill-chip"
                      style={{ fontSize: `${0.75 + (count / maxSkillFreq) * 0.5}rem`, opacity: 0.6 + (count / maxSkillFreq) * 0.4 }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Session recaps */}
            <section className="sd-section">
              <h2 className="sd-subsection-title">Конспекты уроков</h2>
              {sessionHistory.length === 0 ? (
                <p className="sd-empty">После первого онлайн-урока здесь появится история.</p>
              ) : (
                sessionHistory.map(group => (
                  <div key={group.studentId} className="sd-tutor-block">
                    <p className="sd-tutor-block-label">
                      {group.studentFirstName} {group.studentLastName}
                      {group.tutorName && <span className="sd-tutor-name"> — {group.tutorName}</span>}
                    </p>
                    <div className="sd-lessons">
                      {(group.sessions || []).map(sess => (
                        <SessionHistoryItem key={sess.snapshotId} session={sess} token={token} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* Tutor progress notes */}
            <section className="sd-section">
              <h2 className="sd-subsection-title">Заметки репетитора</h2>
              {profiles.length === 0 ? (
                <p className="sd-empty">Нет данных о прогрессе.</p>
              ) : (
                profiles.map(student => {
                  const notes = progressNotes[student.id] || [];
                  return (
                    <div key={student.id} className="sd-tutor-block">
                      <p className="sd-tutor-block-label">
                        {student.firstName} {student.lastName}
                        {student.tutorName && <span className="sd-tutor-name"> — {student.tutorName}</span>}
                      </p>
                      {notes.length === 0 ? (
                        <p className="sd-empty">Нет заметок</p>
                      ) : (
                        <div className="sd-lessons">
                          {notes.map(note => (
                            <div key={note.id} className="sd-lesson-card">
                              <div className="sd-lesson-meta">
                                <span className="sd-lesson-date">
                                  {note.date ? new Date(note.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                                </span>
                                <span className="sd-lesson-time">{'★'.repeat(note.rating)}{'☆'.repeat(5 - note.rating)}</span>
                              </div>
                              {note.noteText && <p className="sd-lesson-note">{note.noteText}</p>}
                              {note.skillTags?.length > 0 && (
                                <div className="sd-interests">
                                  {note.skillTags.map((tag, i) => (
                                    <span key={i} className="sv-interest-tag">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          </div>
        )}
      </div>

      {/* Calendar tooltip */}
      {calTooltip && (
        <div className="sd-cal-tooltip" style={calTooltipStyle} ref={calTooltipRef}>
          <div className="sd-cal-tooltip__date">
            {new Date(calYear, calMonth, calTooltip.day).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {calTooltip.lessons.map((l, i) => {
            const dateKey = formatDateKey(calYear, calMonth, calTooltip.day);
            const isToday = dateKey === todayKey;
            const hasLive = isToday && liveSession && l.tutorId === liveSession.tutorId;
            const studentProfile = profiles.find(p => p.id === l.studentId);
            const mats = studentProfile ? getMaterials(studentProfile, dateKey) : [];
            return (
              <div key={i} className="sd-cal-tooltip__lesson">
                <div className="sd-cal-tooltip__avatar">{getCalInitials(l.tutorName || '')}</div>
                <div className="sd-cal-tooltip__info">
                  <span className="sd-cal-tooltip__name">{l.tutorName || 'Репетитор'}</span>
                  {l.time && <span className="sd-cal-tooltip__time">{l.time}</span>}
                  {l.note && <span className="sd-cal-tooltip__note">{l.note}</span>}
                  {mats.length > 0 && (
                    <div className="sd-cal-tooltip__mats">
                      {mats.map((m, j) => (
                        <a key={j} href={m.url} target="_blank" rel="noopener noreferrer" download className="sd-cal-tooltip__mat-link">
                          📄 {m.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {hasLive && (
                  <a
                    href={`/live/student/${liveSession.sessionId}`}
                    className="btn btn-primary sd-cal-tooltip__join"
                    onClick={() => setCalTooltip(null)}
                  >
                    Подключиться
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Session history item component ───────────────────────────────────────────
function SessionHistoryItem({ session, token }) {
  const [expanded, setExpanded] = useState(false);
  const [recap, setRecap] = useState(null);
  const [loadingRecap, setLoadingRecap] = useState(false);

  const handleExpand = async () => {
    setExpanded(!expanded);
    if (!expanded && session.hasRecap && !recap) {
      setLoadingRecap(true);
      try {
        const res = await studentAccountApi.getSnapshotRecap(token, session.snapshotId);
        setRecap(res.data);
      } catch { /* recap load failed */ } finally {
        setLoadingRecap(false);
      }
    }
  };

  const formatDate = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="sd-lesson-card">
      <div className="sd-lesson-meta" style={{ cursor: 'pointer' }} onClick={handleExpand}>
        <span className="sd-lesson-date">{formatDate(session.endedAt)}</span>
        <span className="sd-lesson-time">{session.durationMinutes} мин</span>
        {session.slideCount > 0 && <span className="sd-lesson-time">{session.slideCount} слайдов</span>}
        {session.hasRecap && <span className="sv-interest-tag">Конспект</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {session.title && <p className="sd-lesson-note">{session.title}</p>}
      {expanded && (
        <div style={{ marginTop: '8px', fontSize: '0.875rem' }}>
          {loadingRecap && <p style={{ color: 'var(--text-secondary)' }}>Загрузка конспекта...</p>}
          {recap && !recap.generationFailed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recap.topicsCovered?.length > 0 && (
                <div>
                  <strong>Темы урока:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {recap.topicsCovered.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              {recap.struggledWith?.length > 0 && (
                <div>
                  <strong>Трудности:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {recap.struggledWith.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              {recap.homeworkAssigned && (
                <div><strong>Домашнее задание:</strong> {recap.homeworkAssigned}</div>
              )}
              {recap.nextSessionFocus && (
                <div><strong>На следующий урок:</strong> {recap.nextSessionFocus}</div>
              )}
            </div>
          )}
          {!loadingRecap && !recap && session.hasRecap && (
            <p style={{ color: 'var(--text-secondary)' }}>Не удалось загрузить конспект.</p>
          )}
          {!session.hasRecap && (
            <p style={{ color: 'var(--text-secondary)' }}>Конспект не создан.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;
