import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentApi, studentAccountApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import './StudentView.css';

function StudentView({ studentAccountId }) {
  const { studentId } = useParams();
  const [linked, setLinked] = useState(false);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentApi.getStudentPublic(studentId)
      .then(r => setStudent(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Check if already linked
    if (studentAccountId) {
      const token = localStorage.getItem('studentToken');
      studentAccountApi.getMe(token)
        .then(r => setLinked((r.data.linkedStudentIds || []).includes(studentId)))
        .catch(() => {});
    }
  }, [studentId, studentAccountId]);

  if (loading) {
    return (
      <div className="sv-container">
        <header className="sv-header">
          <div className="sv-header-inner">
            <div className="sv-brand">
              <div className="sv-logo">TL</div>
              <span className="sv-brand-name">TutorLab</span>
            </div>
          </div>
        </header>
        <div className="sv-body sv-loading">Загрузка...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="sv-container">
        <header className="sv-header">
          <div className="sv-header-inner">
            <div className="sv-brand">
              <div className="sv-logo">TL</div>
              <span className="sv-brand-name">TutorLab</span>
            </div>
          </div>
        </header>
        <div className="sv-body sv-not-found">Страница не найдена</div>
      </div>
    );
  }

  const photoUrl = student.photoUrl
    ? (student.photoUrl.startsWith('/api/') ? `${API_BASE}${student.photoUrl}` : student.photoUrl)
    : null;

  const fullName = `${student.firstName} ${student.lastName}`.trim();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lessons = (student.lessonDates || []).map(dateStr => {
    if (dateStr.includes('|')) {
      const [date, time, note] = dateStr.split('|');
      return { date, time: time || '', note: note || '' };
    }
    return { date: dateStr, time: '', note: '' };
  });

  const upcoming = lessons
    .filter(l => new Date(l.date) >= today)
    .sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date);
      return d !== 0 ? d : (a.time || '').localeCompare(b.time || '');
    });

  const past = lessons
    .filter(l => new Date(l.date) < today)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const todayStr = new Date().toDateString();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === todayStr) return 'Сегодня';
    if (d.toDateString() === tomorrow.toDateString()) return 'Завтра';
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getLessonMaterials = (date) => {
    const mats = student.lessonMaterials?.[date] || [];
    return mats.map(url => ({
      url: url.startsWith('/api/') ? `${API_BASE}${url}` : url,
      name: decodeURIComponent(url.split('/').pop()),
    }));
  };

  const allMaterials = (student.materialUrls || []).map((url, i) => ({
    url: url.startsWith('/api/') ? `${API_BASE}${url}` : url,
    name: decodeURIComponent(url.split('/').pop() || `Материал ${i + 1}`),
  }));

  const handleLinkMe = async () => {
    const token = localStorage.getItem('studentToken');
    if (!token) return;
    try {
      await studentAccountApi.link(token, studentId);
      localStorage.setItem('linkedStudentId', studentId);
      setLinked(true);
      toast.success('Профиль привязан к вашему аккаунту');
    } catch {
      toast.error('Не удалось привязать профиль');
    }
  };

  return (
    <div className="sv-container">
      <header className="sv-header">
        <div className="sv-header-inner">
          <div className="sv-brand">
            <div className="sv-logo">TL</div>
            <span className="sv-brand-name">TutorLab</span>
          </div>
          <span className="sv-tagline">Кабинет ученика</span>
          <div className="sv-nav-actions">
            {studentAccountId ? (
              <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => window.location.href = '/me'}>Мой кабинет</button>
            ) : (
              <a href="/home" className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>Войти как ученик</a>
            )}
          </div>
        </div>
      </header>

      <div className="sv-body">
        {/* Link prompt: student is logged in but this profile isn't linked yet */}
        {studentAccountId && !linked && (
          <div className="sv-link-banner">
            <span>Это ваш профиль?</span>
            <button className="btn btn-primary sv-link-btn" onClick={handleLinkMe}>
              Привязать к моему аккаунту
            </button>
          </div>
        )}
        {linked && (
          <div className="sv-link-banner sv-link-done">
            Профиль привязан к вашему аккаунту ✓
          </div>
        )}

        {/* Profile card */}
        <div className="sv-profile-card">
          {photoUrl ? (
            <img src={photoUrl} alt={fullName} className="sv-avatar" />
          ) : (
            <div className="sv-avatar-placeholder">
              {student.firstName.charAt(0)}{student.lastName.charAt(0)}
            </div>
          )}
          <div className="sv-profile-info">
            <h1 className="sv-name">{fullName}</h1>
            {student.age && <p className="sv-age">{student.age} лет</p>}
            {student.interests && student.interests.length > 0 && (
              <div className="sv-interests">
                {student.interests.map((tag, i) => (
                  <span key={i} className="sv-interest-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming lessons */}
        <section className="sv-section">
          <h2 className="sv-section-title">Предстоящие занятия</h2>
          {upcoming.length === 0 ? (
            <p className="sv-empty">Нет запланированных занятий</p>
          ) : (
            <div className="sv-lessons">
              {upcoming.map((lesson, i) => {
                const mats = getLessonMaterials(lesson.date);
                const isNow = new Date(lesson.date).toDateString() === new Date().toDateString();
                return (
                  <div key={i} className={`sv-lesson-card ${isNow ? 'sv-today' : ''}`}>
                    <div className="sv-lesson-meta">
                      <span className="sv-lesson-date">{formatDate(lesson.date)}</span>
                      {lesson.time && <span className="sv-lesson-time">{lesson.time}</span>}
                    </div>
                    {lesson.note && <p className="sv-lesson-note">{lesson.note}</p>}
                    {mats.length > 0 && (
                      <ul className="sv-lesson-mats">
                        {mats.map((m, j) => (
                          <li key={j}>
                            <a href={m.url} target="_blank" rel="noopener noreferrer" download>
                              📄 {m.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* All materials */}
        {allMaterials.length > 0 && (
          <section className="sv-section">
            <h2 className="sv-section-title">Материалы</h2>
            <ul className="sv-materials-list">
              {allMaterials.map((m, i) => (
                <li key={i}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" download>
                    📄 {m.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Lesson history */}
        {past.length > 0 && (
          <section className="sv-section">
            <h2 className="sv-section-title">История занятий</h2>
            <div className="sv-lessons sv-past">
              {past.map((lesson, i) => {
                const mats = getLessonMaterials(lesson.date);
                return (
                  <div key={i} className="sv-lesson-card sv-past-card">
                    <div className="sv-lesson-meta">
                      <span className="sv-lesson-date">{formatDate(lesson.date)}</span>
                      {lesson.time && <span className="sv-lesson-time">{lesson.time}</span>}
                    </div>
                    {lesson.note && <p className="sv-lesson-note">{lesson.note}</p>}
                    {mats.length > 0 && (
                      <ul className="sv-lesson-mats">
                        {mats.map((m, j) => (
                          <li key={j}>
                            <a href={m.url} target="_blank" rel="noopener noreferrer" download>
                              📄 {m.name}
                            </a>
                          </li>
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
    </div>
  );
}

export default StudentView;
