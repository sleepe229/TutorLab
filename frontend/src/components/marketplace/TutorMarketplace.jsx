import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { tutorApi, chatApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import ThemeToggle from '../ui/ThemeToggle';
import './TutorMarketplace.css';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.slice(0, 2).toUpperCase();
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

  return (
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

        {loading ? (
          <div className="mkt-empty">Загрузка...</div>
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
                      ? <img src={photo} alt={tutor.fullName} className="mkt-card__avatar" />
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
                        const token = localStorage.getItem('studentToken');
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
    </div>
  );
}

export default TutorMarketplace;
