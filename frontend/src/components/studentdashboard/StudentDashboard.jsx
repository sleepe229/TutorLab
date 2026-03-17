import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { studentApi, studentAccountApi } from '../../services/api'; // studentAccountApi used for getMe
import { API_BASE } from '../../config.js';
import ThemeToggle from '../ui/ThemeToggle';
import ChatPanel from '../chat/ChatPanel';
import './StudentDashboard.css';

function StudentDashboard({ studentAccountId, onLogout }) {
  const [account, setAccount] = useState(null);
  const [profiles, setProfiles] = useState([]); // [{student, tutorLabel}]
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);

  const token = localStorage.getItem('studentToken');
  const firstName = localStorage.getItem('studentFirstName') || '';
  const lastName = localStorage.getItem('studentLastName') || '';

  useEffect(() => { loadData(); }, [studentAccountId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await studentAccountApi.getMe(token);
      const acc = meRes.data;
      setAccount(acc);

      const ids = acc.linkedStudentIds || [];
      const loaded = await Promise.all(
        ids.map(id =>
          studentApi.getStudentPublic(id)
            .then(r => r.data)
            .catch(() => null)
        )
      );
      setProfiles(loaded.filter(Boolean));
    } catch {
      toast.error('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const parseLessons = (student) =>
    (student?.lessonDates || []).map(d => {
      if (d.includes('|')) {
        const [date, time, note] = d.split('|');
        return { date, time: time || '', note: note || '' };
      }
      return { date: d, time: '', note: '' };
    });

  const formatDate = (d) => {
    const date = new Date(d);
    const todayStr = new Date().toDateString();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === todayStr) return 'Сегодня';
    if (date.toDateString() === tomorrow.toDateString()) return 'Завтра';
    return date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getMaterials = (student, date) =>
    (student?.lessonMaterials?.[date] || []).map(url => ({
      url: url.startsWith('/api/') ? `${API_BASE}${url}` : url,
      name: decodeURIComponent(url.split('/').pop()),
    }));

  const getPhotoUrl = (url) =>
    url ? (url.startsWith('/api/') ? `${API_BASE}${url}` : url) : null;

  const displayName = firstName + (lastName ? ` ${lastName}` : '');

  // Aggregate upcoming lessons across all profiles for the greeting
  const allUpcoming = profiles.flatMap(s =>
    parseLessons(s).filter(l => new Date(l.date) >= today)
  );

  return (
    <div className="sd-container">
      <header className="sd-nav">
        <div className="sd-nav-inner">
          <div className="sd-brand">
            <div className="sd-logo">TL</div>
            <span className="sd-brand-name">TutorLab</span>
          </div>
          <span className="sd-nav-title">Кабинет ученика</span>
          <div className="sd-nav-actions">
            <button className="nav-link nav-link-btn" onClick={() => window.location.href = '/tutors'}>Репетиторы</button>
            <ThemeToggle />
            <button
              className="nav-icon-btn"
              onClick={() => window.location.href = '/chat'}
              aria-label="Сообщения"
              title="Сообщения"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
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

      <div className="sd-body">
        {loading ? (
          <div className="sd-loading">Загрузка...</div>
        ) : (
          <>
            {/* Greeting */}
            <div className="sd-greeting">
              <h1>Привет{displayName ? `, ${displayName}` : ''}!</h1>
              {allUpcoming.length > 0 && (
                <p className="sd-greeting-sub">
                  {allUpcoming.length} {allUpcoming.length === 1 ? 'предстоящий урок' : allUpcoming.length < 5 ? 'предстоящих урока' : 'предстоящих уроков'}
                </p>
              )}
            </div>

            {/* Find a tutor */}
            {profiles.length === 0 && (
              <div className="sd-link-section">
                <h2 className="sd-section-title">Найдите репетитора</h2>
                <p className="sd-link-hint">
                  Просматривайте анкеты преподавателей и начните заниматься уже сегодня.
                </p>
                <button className="btn btn-primary" onClick={() => window.location.href = '/tutors'}>
                  Смотреть репетиторов
                </button>
              </div>
            )}

            {/* One card per linked profile (tutor) */}
            {profiles.map(student => {
              const lessons = parseLessons(student);
              const upcoming = lessons.filter(l => new Date(l.date) >= today)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
              const past = lessons.filter(l => new Date(l.date) < today)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
              const allMats = (student.materialUrls || []).map((url, i) => ({
                url: url.startsWith('/api/') ? `${API_BASE}${url}` : url,
                name: decodeURIComponent(url.split('/').pop() || `Материал ${i + 1}`),
              }));

              return (
                <div key={student.id} className="sd-tutor-block">
                  {/* Profile row */}
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

                  {/* Upcoming lessons */}
                  <section className="sd-section">
                    <h2 className="sd-section-title">Предстоящие занятия</h2>
                    {upcoming.length === 0 ? (
                      <p className="sd-empty">Нет запланированных занятий</p>
                    ) : (
                      <div className="sd-lessons">
                        {upcoming.map((l, i) => {
                          const mats = getMaterials(student, l.date);
                          const isNow = new Date(l.date).toDateString() === new Date().toDateString();
                          return (
                            <div key={i} className={`sd-lesson-card ${isNow ? 'sd-today' : ''}`}>
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
                    )}
                  </section>

                  {/* General materials */}
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

                  {/* Lesson history */}
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
        )}
      </div>
      {showChat && (
        <ChatPanel
          role="STUDENT"
          senderId={studentAccountId}
          senderName={displayName}
          token={token}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}

export default StudentDashboard;
