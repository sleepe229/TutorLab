import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { tutorApi, chatApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import ThemeToggle from '../ui/ThemeToggle';
import './TutorProfilePage.css';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.slice(0, 2).toUpperCase();
}

function TutorProfilePage({ studentAccountId }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    tutorApi.getTutorProfile(id)
      .then(r => setTutor(r.data))
      .catch(() => setTutor(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleContact = async () => {
    if (!studentAccountId) {
      navigate('/home');
      return;
    }
    setChatLoading(true);
    try {
      const firstName = localStorage.getItem('studentFirstName') || '';
      const lastName = localStorage.getItem('studentLastName') || '';
      const name = `${firstName} ${lastName}`.trim() || 'Ученик';
      const token = localStorage.getItem('studentToken');
      await chatApi.getOrCreateAsStudent(id, studentAccountId, name, token);
      navigate('/chat');
    } catch {
      toast.error('Не удалось открыть чат');
    } finally {
      setChatLoading(false);
    }
  };

  const getPhotoUrl = (url) => url ? (url.startsWith('/api/') ? `${API_BASE}${url}` : url) : null;
  const ABOUT_LIMIT = 300;

  return (
    <>
      {tutor && (
        <Helmet>
          <title>{tutor.fullName} — репетитор | TutorLab</title>
          <meta name="description" content={tutor.about ? tutor.about.slice(0, 155) : `Профиль репетитора ${tutor.fullName} на TutorLab`} />
        </Helmet>
      )}

      <div className="tpp-container">
        {/* Navbar */}
        <header className="tpp-nav">
          <div className="tpp-nav-inner">
            <button className="tpp-brand" onClick={() => navigate('/tutors')}>
              <div className="tpp-logo">TL</div>
              <span className="tpp-brand-name">TutorLab</span>
            </button>
            <button className="tpp-back-btn" onClick={() => navigate(-1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Назад
            </button>
            <div className="tpp-nav-actions">
              <ThemeToggle />
              {studentAccountId ? (
                <button className="btn btn-secondary tpp-nav-btn" onClick={() => navigate('/me')}>Кабинет</button>
              ) : (
                <button className="btn btn-primary tpp-nav-btn" onClick={() => navigate('/home')}>Войти</button>
              )}
            </div>
          </div>
        </header>

        <div className="tpp-body">
          {loading ? (
            <div className="tpp-loading">
              <div className="tpp-skeleton tpp-skeleton--avatar" />
              <div className="tpp-skeleton tpp-skeleton--name" />
              <div className="tpp-skeleton tpp-skeleton--tags" />
              <div className="tpp-skeleton tpp-skeleton--text" />
            </div>
          ) : !tutor ? (
            <div className="tpp-not-found">
              <h2>Профиль не найден</h2>
              <p>Возможно, репетитор удалил свой аккаунт или ссылка устарела.</p>
              <button className="btn btn-primary" onClick={() => navigate('/tutors')}>Все репетиторы</button>
            </div>
          ) : (
            <div className="tpp-profile">
              {/* Hero card */}
              <div className="tpp-hero">
                <div className="tpp-hero-avatar-wrap">
                  {getPhotoUrl(tutor.photoUrl)
                    ? <img src={getPhotoUrl(tutor.photoUrl)} alt={tutor.fullName} className="tpp-avatar-img" />
                    : <div className="tpp-avatar-ph">{getInitials(tutor.fullName)}</div>
                  }
                </div>
                <div className="tpp-hero-info">
                  <h1 className="tpp-name">{tutor.fullName}</h1>
                  {tutor.hourlyRate != null && (
                    <div className="tpp-rate-badge">{tutor.hourlyRate} ₽/час</div>
                  )}
                  {tutor.subjects?.length > 0 && (
                    <div className="tpp-subjects">
                      {tutor.subjects.map((s, i) => (
                        <span key={i} className="tpp-subject-chip">{s}</span>
                      ))}
                    </div>
                  )}
                  <button
                    className="btn btn-primary tpp-contact-btn"
                    onClick={handleContact}
                    disabled={chatLoading}
                  >
                    {chatLoading ? 'Открытие...' : 'Написать'}
                  </button>
                </div>
              </div>

              {/* About section */}
              {tutor.about && (
                <section className="tpp-section">
                  <h2 className="tpp-section-title">О себе</h2>
                  <div className="tpp-about">
                    <p className="tpp-about-text">
                      {aboutExpanded || tutor.about.length <= ABOUT_LIMIT
                        ? tutor.about
                        : tutor.about.slice(0, ABOUT_LIMIT) + '...'}
                    </p>
                    {tutor.about.length > ABOUT_LIMIT && (
                      <button
                        className="tpp-expand-btn"
                        onClick={() => setAboutExpanded(v => !v)}
                      >
                        {aboutExpanded ? 'Свернуть' : 'Читать полностью'}
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* Subjects detail */}
              {tutor.subjects?.length > 0 && (
                <section className="tpp-section">
                  <h2 className="tpp-section-title">Предметы</h2>
                  <div className="tpp-subjects-list">
                    {tutor.subjects.map((s, i) => (
                      <span key={i} className="tpp-subject-chip tpp-subject-chip--lg">{s}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* CTA strip */}
              <div className="tpp-cta-strip">
                <div className="tpp-cta-text">
                  <strong>Хотите заниматься с {tutor.fullName?.split(' ')[0]}?</strong>
                  <span>Напишите репетитору — первый урок бесплатно</span>
                </div>
                <button
                  className="btn btn-primary tpp-cta-btn"
                  onClick={handleContact}
                  disabled={chatLoading}
                >
                  {chatLoading ? 'Открытие...' : 'Написать'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default TutorProfilePage;
