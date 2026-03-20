import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { tutorApi, chatApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import ThemeToggle from '../ui/ThemeToggle';
import Footer from '../ui/Footer';
import './TutorMarketplace.css';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.slice(0, 2).toUpperCase();
}

function TutorCardSkeleton() {
  return (
    <div className="mkt-card mkt-card--skeleton" aria-hidden="true">
      <div className="mkt-card__header">
        <div className="mkt-skeleton mkt-skeleton--avatar" />
        <div className="mkt-card__meta">
          <div className="mkt-skeleton mkt-skeleton--name" />
          <div className="mkt-skeleton mkt-skeleton--rate" />
        </div>
      </div>
      <div className="mkt-skeleton mkt-skeleton--tags" />
      <div className="mkt-skeleton mkt-skeleton--text" />
      <div className="mkt-skeleton mkt-skeleton--text mkt-skeleton--text-short" />
    </div>
  );
}

function buildMarketplaceSchema(tutors) {
  if (!tutors.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Репетиторы на TutorLab',
    description: 'Список репетиторов, доступных для онлайн-занятий через платформу TutorLab',
    url: 'https://tutorlab.onrender.com/tutors',
    numberOfItems: tutors.length,
    itemListElement: tutors.map((tutor, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: tutor.subjects?.length
          ? `Репетитор по ${tutor.subjects.join(', ')} — ${tutor.fullName}`
          : `Репетитор ${tutor.fullName}`,
        provider: {
          '@type': 'Person',
          name: tutor.fullName,
          description: tutor.about || undefined,
          knowsAbout: tutor.subjects || undefined,
        },
        serviceType: 'Репетиторство',
        ...(tutor.hourlyRate != null && {
          offers: {
            '@type': 'Offer',
            price: String(tutor.hourlyRate),
            priceCurrency: 'RUB',
          },
        }),
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceUrl: 'https://tutorlab.onrender.com/tutors',
          availableLanguage: 'Russian',
        },
      },
    })),
  };
}

function TutorMarketplace({ studentAccountId }) {
  const navigate = useNavigate();
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [maxRate, setMaxRate] = useState('');

  useEffect(() => {
    tutorApi.getPublicTutors()
      .then(r => setTutors(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // All unique subjects across tutors
  const allSubjects = useMemo(() => {
    const set = new Set();
    tutors.forEach(t => (t.subjects || []).forEach(s => set.add(s)));
    return [...set].sort();
  }, [tutors]);

  const filtered = useMemo(() => {
    return tutors.filter(t => {
      if (search) {
        const q = search.toLowerCase();
        if (!(t.fullName || '').toLowerCase().includes(q) &&
            !(t.about || '').toLowerCase().includes(q) &&
            !(t.subjects || []).some(s => s.toLowerCase().includes(q))) {
          return false;
        }
      }
      if (subjectFilter && !(t.subjects || []).includes(subjectFilter)) return false;
      if (maxRate && t.hourlyRate != null && t.hourlyRate > parseInt(maxRate)) return false;
      return true;
    });
  }, [tutors, search, subjectFilter, maxRate]);

  const getPhotoUrl = (url) => url ? (url.startsWith('/api/') ? `${API_BASE}${url}` : url) : null;

  const schemaData = useMemo(() => buildMarketplaceSchema(filtered), [filtered]);

  return (
    <>
      <Helmet>
        <title>Репетиторы онлайн — TutorLab | Найдите преподавателя</title>
        <meta name="description" content="Найдите репетитора для онлайн-занятий на TutorLab. Фильтрация по предмету и цене. Математика, физика, английский и другие предметы." />
        <link rel="canonical" href="https://tutorlab.onrender.com/tutors" />
        <meta property="og:title" content="Репетиторы онлайн — TutorLab" />
        <meta property="og:description" content="Найдите репетитора для онлайн-занятий. Математика, физика, английский и другие предметы." />
        <meta property="og:url" content="https://tutorlab.onrender.com/tutors" />
        {schemaData && (
          <script type="application/ld+json">
            {JSON.stringify(schemaData)}
          </script>
        )}
      </Helmet>

      <div className="mkt-container">
        <header className="mkt-nav">
          <div className="mkt-nav-inner">
            <button className="mkt-brand" onClick={() => navigate(studentAccountId ? '/me' : '/home')} aria-label="Главная">
              <div className="mkt-logo">TL</div>
              <span className="mkt-brand-name">TutorLab</span>
            </button>
            <span className="mkt-nav-title">Репетиторы</span>
            <div className="mkt-nav-actions">
              <ThemeToggle />
              {studentAccountId ? (
                <button className="btn btn-secondary" onClick={() => navigate('/me')}>Кабинет</button>
              ) : (
                <button className="btn btn-primary" onClick={() => navigate('/home')}>Войти</button>
              )}
            </div>
          </div>
        </header>

        <div className="mkt-body">
          <div className="mkt-hero">
            <h1 className="mkt-title">Найдите своего репетитора</h1>
            <p className="mkt-sub">Просматривайте анкеты преподавателей и выбирайте подходящего</p>
          </div>

          {/* Filters */}
          <div className="mkt-filters">
            <input
              className="mkt-search"
              type="text"
              placeholder="Поиск по имени, предмету..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="mkt-select"
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
            >
              <option value="">Все предметы</option>
              {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="mkt-rate-filter">
              <input
                className="mkt-rate-input"
                type="number"
                placeholder="Макс. цена/час"
                value={maxRate}
                onChange={e => setMaxRate(e.target.value)}
                min="0"
              />
            </div>
          </div>

          <h2 className="mkt-section-title">
            {loading ? 'Загрузка репетиторов...' : `Репетиторы${filtered.length ? ` (${filtered.length})` : ''}`}
          </h2>

          {loading ? (
            <div className="mkt-grid">
              {Array.from({ length: 6 }).map((_, i) => <TutorCardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mkt-empty">
              {tutors.length === 0 ? 'Нет доступных репетиторов' : 'Не найдено по фильтрам'}
            </div>
          ) : (
            <div className="mkt-grid">
              {filtered.map(tutor => {
                const photo = getPhotoUrl(tutor.photoUrl);
                return (
                  <div key={tutor.id} className="mkt-card">
                    <div className="mkt-card__header">
                      {photo
                        ? <img
                            src={photo}
                            alt={tutor.fullName}
                            className="mkt-card__avatar"
                            width="64"
                            height="64"
                            loading="lazy"
                          />
                        : <div className="mkt-card__avatar-ph">{getInitials(tutor.fullName)}</div>
                      }
                      <div className="mkt-card__meta">
                        <h3 className="mkt-card__name">{tutor.fullName}</h3>
                        {tutor.hourlyRate != null && (
                          <span className="mkt-card__rate">{tutor.hourlyRate} ₽/час</span>
                        )}
                      </div>
                    </div>

                    {tutor.subjects?.length > 0 && (
                      <div className="mkt-card__subjects">
                        {tutor.subjects.map((s, i) => (
                          <span key={i} className="mkt-card__subject-tag">{s}</span>
                        ))}
                      </div>
                    )}

                    {tutor.about && (
                      <p className="mkt-card__about">{tutor.about}</p>
                    )}

                    <div className="mkt-card__actions">
                      <button
                        className="btn btn-primary mkt-card__contact"
                        onClick={async () => {
                          if (!studentAccountId) {
                            navigate('/home');
                            return;
                          }
                          const firstName = localStorage.getItem('studentFirstName') || '';
                          const lastName = localStorage.getItem('studentLastName') || '';
                          const name = `${firstName} ${lastName}`.trim() || 'Ученик';
                          try {
                            await chatApi.getOrCreate(tutor.id, studentAccountId, name);
                            navigate('/chat');
                          } catch {
                            toast.error('Не удалось открыть чат');
                          }
                        }}
                      >
                        Написать
                      </button>
                      <div className="mkt-card__price-placeholder">
                        {tutor.hourlyRate != null ? (
                          <span>от {tutor.hourlyRate} ₽</span>
                        ) : (
                          <span className="mkt-card__price-free">Цена договорная</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}

export default TutorMarketplace;