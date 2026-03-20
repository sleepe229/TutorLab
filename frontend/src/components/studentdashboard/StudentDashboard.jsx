import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentApi, studentAccountApi, liveApi, progressApi } from '../../services/api';
import { connectToTutorUpdates } from '../../services/wsClient';
import { API_BASE } from '../../config.js';
import { parseLocalDate } from '../../utils/date';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import ThemeToggle from '../ui/ThemeToggle';
import './StudentDashboard.css';

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
  const wsLiveRef = useRef(null);

  const token = localStorage.getItem('studentToken');
  const firstName = localStorage.getItem('studentFirstName') || '';
  const lastName = localStorage.getItem('studentLastName') || '';
  const unreadCount = useUnreadCount('STUDENT', studentAccountId, token);

  useEffect(() => { loadData(); }, [studentAccountId]);

  useEffect(() => {
    return () => wsLiveRef.current?.disconnect();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await studentAccountApi.getMe(token);
      const acc = meRes.data;
      setEmail(acc.email || '');

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
          <div className="sd-brand">
            <div className="sd-logo">TL</div>
            <span className="sd-brand-name">TutorLab</span>
          </div>

          <nav className="sd-nav-tabs">
            {[
              { key: 'home', label: 'Кабинет' },
              { key: 'schedule', label: 'Расписание' },
              { key: 'progress', label: 'Прогресс' },
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
              <div className="sd-avatar-placeholder sd-avatar-lg">
                {initials || '?'}
              </div>
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
                        <div key={p.id} className={`sd-tutor-chip${isLive ? ' sd-tutor-chip--live' : ''}`}>
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
        ) : activeTab === 'schedule' ? (
          /* ── Schedule tab ── */
          <div className="sd-schedule">
            <div className="sd-greeting">
              <h1>Расписание занятий</h1>
              {allUpcoming.length > 0 && (
                <p className="sd-greeting-sub">{allUpcoming.length} предстоящих</p>
              )}
            </div>

            {allUpcoming.length === 0 && allPast.length === 0 && (
              <div className="sd-link-section">
                <p className="sd-link-hint">Нет занятий. Попросите репетитора добавить расписание.</p>
              </div>
            )}

            {allUpcoming.length > 0 && (
              <section className="sd-section">
                <h2 className="sd-section-title">Предстоящие</h2>
                <div className="sd-lessons">
                  {allUpcoming.map((l, i) => {
                    const studentProfile = profiles.find(p => p.id === l.studentId);
                    return renderLessonCard(l, i, studentProfile);
                  })}
                </div>
              </section>
            )}

            {allPast.length > 0 && (
              <section className="sd-section">
                <button
                  className="sd-past-toggle"
                  onClick={() => setPastExpanded(v => !v)}
                >
                  {pastExpanded
                    ? `Скрыть историю занятий ▲`
                    : `Показать историю занятий (${allPast.length}) ▼`}
                </button>
                {pastExpanded && (
                  <div className="sd-lessons sd-past" style={{ marginTop: '12px' }}>
                    {allPast.slice(0, 30).map((l, i) => {
                      const studentProfile = profiles.find(p => p.id === l.studentId);
                      const isToday = parseLocalDate(l.date).toDateString() === today.toDateString();
                      const mats = studentProfile ? getMaterials(studentProfile, l.date) : [];
                      return (
                        <div key={i} className={`sd-lesson-card sd-past-card${isToday ? ' sd-today' : ''}`}>
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
          /* ── Progress tab (merged: session history + tutor notes) ── */
          <div className="sd-schedule">
            <div className="sd-greeting">
              <h1>Прогресс</h1>
              <p className="sd-greeting-sub">Конспекты уроков и заметки репетитора</p>
            </div>

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
