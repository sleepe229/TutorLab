import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { studentApi, studentAccountApi, liveApi } from '../../services/api';
import { API_BASE } from '../../config.js'; // used for photo/material URLs
import { parseLocalDate } from '../../utils/date';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import ThemeToggle from '../ui/ThemeToggle';
import './StudentDashboard.css';

function StudentDashboard({ studentAccountId, onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'schedule'
  const [liveSession, setLiveSession] = useState(null); // { sessionId, tutorName, tutorId }
  const liveCheckRef = useRef(null);

  const token = localStorage.getItem('studentToken');
  const firstName = localStorage.getItem('studentFirstName') || '';
  const lastName = localStorage.getItem('studentLastName') || '';
  const unreadCount = useUnreadCount('STUDENT', studentAccountId, token);

  useEffect(() => { loadData(); }, [studentAccountId]);

  useEffect(() => {
    return () => { if (liveCheckRef.current) clearInterval(liveCheckRef.current); };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await studentAccountApi.getMe(token);
      const acc = meRes.data;

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
      startLivePolling(valid);
    } catch {
      toast.error('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const startLivePolling = (profileList) => {
    if (liveCheckRef.current) clearInterval(liveCheckRef.current);
    const tutorIds = [...new Set(profileList.map(p => p.tutorId).filter(Boolean))];
    if (tutorIds.length === 0) return;

    const checkSessions = async () => {
      // Skip polling when page is not visible to reduce unnecessary server load
      if (document.visibilityState === 'hidden') return;
      for (const tutorId of tutorIds) {
        try {
          const res = await liveApi.getSessionByTutor(tutorId);
          const session = res.data;
          const profile = profileList.find(p => p.tutorId === tutorId);
          const tutorName = profile?.tutorName || 'Преподаватель';
          setLiveSession(prev =>
            prev?.sessionId === session.sessionId ? prev : { sessionId: session.sessionId, tutorName, tutorId }
          );
          return;
        } catch { /* 404 = no active session for this tutor, continue */ }
      }
      setLiveSession(null);
    };

    checkSessions();
    // Poll every 30 s (was 10 s) to reduce server load; skip hidden tabs via visibilityState check above
    liveCheckRef.current = setInterval(checkSessions, 30000);
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

  const getPhotoUrl = (url) =>
    url ? (url.startsWith('/api/') ? `${API_BASE}${url}` : url) : null;

  const displayName = firstName + (lastName ? ` ${lastName}` : '');

  const allUpcoming = profiles
    .flatMap(s => parseLessons(s).filter(l => parseLocalDate(l.date) >= today))
    .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  const allPast = profiles
    .flatMap(s => parseLessons(s).filter(l => parseLocalDate(l.date) < today))
    .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));

  return (
    <div className="sd-container">
      <header className="sd-nav">
        <div className="sd-nav-inner">
          <div className="sd-brand">
            <div className="sd-logo">TL</div>
            <span className="sd-brand-name">TutorLab</span>
          </div>

          <nav className="sd-nav-tabs">
            <button
              className={`sd-tab${activeTab === 'home' ? ' sd-tab--active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              Кабинет
            </button>
            <button
              className={`sd-tab${activeTab === 'schedule' ? ' sd-tab--active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              Расписание
            </button>
          </nav>

          <div className="sd-nav-actions">
            <button className="nav-link nav-link-btn" onClick={() => window.location.href = '/tutors'}>Репетиторы</button>
            <ThemeToggle />
            <button
              className="nav-icon-btn"
              onClick={() => window.location.href = '/chat'}
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

      {/* Live session notification banner */}
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
          <>
            <div className="sd-greeting">
              <h1>Привет{displayName ? `, ${displayName}` : ''}!</h1>
              {allUpcoming.length > 0 && (
                <p className="sd-greeting-sub">
                  {allUpcoming.length === 1 ? '1 предстоящий урок'
                    : allUpcoming.length < 5 ? `${allUpcoming.length} предстоящих урока`
                    : `${allUpcoming.length} предстоящих уроков`}
                </p>
              )}
            </div>

            {profiles.length === 0 && (
              <div className="sd-link-section">
                <h2 className="sd-section-title">Нет активных занятий</h2>
                <p className="sd-link-hint">
                  Попросите репетитора прислать вам ссылку-приглашение, чтобы появиться здесь.
                </p>
              </div>
            )}

            {profiles.map(student => {
              const lessons = parseLessons(student);
              const upcoming = lessons
                .filter(l => parseLocalDate(l.date) >= today)
                .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
              const past = lessons
                .filter(l => parseLocalDate(l.date) < today)
                .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
              const allMats = (student.materialUrls || []).map((url, i) => ({
                url: url.startsWith('/api/') ? `${API_BASE}${url}` : url,
                name: decodeURIComponent(url.split('/').pop() || `Материал ${i + 1}`),
              }));

              return (
                <div key={student.id} className="sd-tutor-block">
                  <div className="sd-profile-card">
                    {getPhotoUrl(student.photoUrl) ? (
                      <img src={getPhotoUrl(student.photoUrl)} alt="" className="sd-avatar" />
                    ) : (
                      <div className="sd-avatar-placeholder">
                        {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="sd-profile-name">{student.firstName} {student.lastName}</p>
                      {student.age && <p className="sd-profile-age">{student.age} лет</p>}
                      {student.tutorName && (
                        <p className="sd-tutor-name">Репетитор: {student.tutorName}</p>
                      )}
                      {student.interests?.length > 0 && (
                        <div className="sd-interests">
                          {student.interests.map((tag, i) => (
                            <span key={i} className="sv-interest-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <section className="sd-section">
                    <h2 className="sd-section-title">Предстоящие занятия</h2>
                    {upcoming.length === 0 ? (
                      <p className="sd-empty">Нет запланированных занятий</p>
                    ) : (
                      <div className="sd-lessons">
                        {upcoming.map((l, i) => {
                          const mats = getMaterials(student, l.date);
                          const isToday = parseLocalDate(l.date).toDateString() === today.toDateString();
                          const hasLive = isToday && liveSession && student.tutorId === liveSession.tutorId;
                          return (
                            <div key={i} className={`sd-lesson-card${isToday ? ' sd-today' : ''}`}>
                              <div className="sd-lesson-meta">
                                <span className="sd-lesson-date">{formatDate(l.date)}</span>
                                {l.time && <span className="sd-lesson-time">{l.time}</span>}
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
                        })}
                      </div>
                    )}
                  </section>

                  {allMats.length > 0 && (
                    <section className="sd-section">
                      <h2 className="sd-section-title">Материалы</h2>
                      <ul className="sd-mats">
                        {allMats.map((m, i) => (
                          <li key={i}><a href={m.url} target="_blank" rel="noopener noreferrer" download>📄 {m.name}</a></li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {past.length > 0 && (
                    <section className="sd-section">
                      <h2 className="sd-section-title">История занятий</h2>
                      <div className="sd-lessons sd-past">
                        {past.map((l, i) => {
                          const mats = getMaterials(student, l.date);
                          return (
                            <div key={i} className="sd-lesson-card sd-past-card">
                              <div className="sd-lesson-meta">
                                <span className="sd-lesson-date">{formatDate(l.date)}</span>
                                {l.time && <span className="sd-lesson-time">{l.time}</span>}
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
                    </section>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          /* ── Schedule tab ── */
          <div className="sd-schedule">
            <div className="sd-greeting">
              <h1>Расписание занятий</h1>
              {allUpcoming.length > 0 && (
                <p className="sd-greeting-sub">{allUpcoming.length} предстоящих занятий</p>
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
                    const isToday = parseLocalDate(l.date).toDateString() === today.toDateString();
                    const hasLive = isToday && liveSession && l.tutorId === liveSession.tutorId;
                    const studentProfile = profiles.find(p => p.id === l.studentId);
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
                  })}
                </div>
              </section>
            )}

            {allPast.length > 0 && (
              <section className="sd-section">
                <h2 className="sd-section-title">Прошедшие</h2>
                <div className="sd-lessons sd-past">
                  {allPast.slice(0, 20).map((l, i) => {
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
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;
