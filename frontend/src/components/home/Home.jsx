import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentApi, tutorApi } from '../../services/api';
import StudentCard from './StudentCard';
import TutorNav from '../ui/TutorNav';
import Onboarding from '../ui/Onboarding';
import InviteStudentModal from '../invite/InviteStudentModal';
import Footer from '../ui/Footer';
import { parseLocalDate } from '../../utils/date';
import './Home.css';

function Home({ tutorId, onLogout }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
const [search, setSearch] = useState('');
  const inviteBtnRef = useRef(null);
  const [tutorName, setTutorName] = useState('');
  const navigate = useNavigate();

  const isAuthenticated = tutorId && tutorId !== 'temp';

  useEffect(() => {
    loadStudents();
    if (isAuthenticated) {
      tutorApi.getTutor(tutorId).then(r => setTutorName(r.data.fullName || '')).catch(() => {});
    }
  }, [tutorId]);

  const loadStudents = async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const response = await studentApi.getStudentsByTutor(tutorId);
      setStudents(response.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const handleStudentAdded = () => { setShowInviteModal(false); loadStudents(); };
  const handleCardClick = (id) => navigate(`/student/${id}`);
  const handleStartLesson = (studentId, studentName) => {
    if (studentId && studentName) {
      navigate(`/live/teacher?studentId=${encodeURIComponent(studentId)}&studentName=${encodeURIComponent(studentName)}`);
    } else {
      navigate('/live/teacher');
    }
  };

  const handleDeleteStudent = async (id) => {
    try {
      await studentApi.deleteStudent(id);
      loadStudents();
    } catch { /* handled by toast in StudentCard */ }
  };

  const handleToggleFavorite = async (id) => {
    try {
      await studentApi.toggleFavorite(id, tutorId);
      loadStudents();
    } catch { /* silent */ }
  };

  const handleMessage = (student) => {
    navigate('/chat');
  };

  const filteredStudents = search.trim()
    ? students.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  // Stats derived from student data
  const totalLessons = students.reduce((sum, s) => sum + (s.lessonDates?.length || 0), 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingToday = students.filter(s =>
    s.lessonDates?.some(d => {
      const dateStr = d.includes('|') ? d.split('|')[0] : d;
      const ld = parseLocalDate(dateStr);
      return ld >= today && ld < new Date(today.getTime() + 86400000);
    })
  ).length;
  return (
    <div className="home-layout">
      <TutorNav tutorId={tutorId} activePage="home" onLogout={onLogout} />

      {/* ── Page Content ───────────────────────────────────────── */}
      <main className="home-content" role="main">
        <div className="container">

          {/* Page header */}
          <div className="page-header">
            <div className="page-header-text">
              <h1 className="page-title">Мои ученики</h1>
              {isAuthenticated && students.length > 0 && (
                <p className="page-subtitle">
                  {students.length} {students.length === 1 ? 'ученик' : students.length < 5 ? 'ученика' : 'учеников'}
                  {upcomingToday > 0 && ` · сегодня ${upcomingToday} урок${upcomingToday > 1 ? 'а' : ''}`}
                </p>
              )}
            </div>
            {isAuthenticated && (
              <div className="page-header-actions">
                <button className="btn btn-orange" onClick={handleStartLesson} aria-label="Начать живой урок">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Начать урок
                </button>
                <button ref={inviteBtnRef} className="btn btn-primary" onClick={() => setShowInviteModal(v => !v)} aria-label="Пригласить ученика">
                  + Пригласить ученика
                </button>
              </div>
            )}
          </div>

          {/* Stats strip */}
          {isAuthenticated && students.length > 0 && (
            <div className="stats-strip" aria-label="Статистика">
              <div className="stat-item">
                <span className="stat-value">{totalLessons}</span>
                <span className="stat-label">Уроков проведено</span>
              </div>
              {upcomingToday > 0 && (
                <>
                  <div className="stat-divider" />
                  <div className="stat-item highlight">
                    <span className="stat-value">{upcomingToday}</span>
                    <span className="stat-label">Сегодня</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Search */}
          {isAuthenticated && students.length > 4 && (
            <div className="students-search-wrap">
              <input
                className="students-search"
                type="text"
                placeholder="Поиск по имени..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          {/* Student list */}
          {loading ? (
            <div className="loading-state" role="status" aria-live="polite">
              <div className="spinner" aria-hidden="true"/>
              <span>Загрузка учеников...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="empty-state" aria-live="polite">
              {isAuthenticated ? (
                <>
                  <div className="empty-state-icon">👨‍🎓</div>
                  <h2 className="empty-state-title">Пока нет учеников</h2>
                  <p className="empty-state-text">Добавьте первого ученика, чтобы начать работу</p>
                  <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
                    + Пригласить ученика
                  </button>
                </>
              ) : (
                <>
                  <div className="empty-state-icon">🔐</div>
                  <h2 className="empty-state-title">Войдите в аккаунт</h2>
                  <p className="empty-state-text">Для работы с учениками необходима авторизация</p>
                </>
              )}
            </div>
          ) : (
            <div className="student-list" role="list" aria-label="Список учеников">
              {/* Favorites first */}
              {filteredStudents.filter(s => s.isFavorite).length > 0 && (
                <div className="list-section">
                  <h2 className="list-section-title">⭐ Избранные</h2>
                  <div className="student-grid">
                    {filteredStudents.filter(s => s.isFavorite).map(student => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        onClick={() => handleCardClick(student.id)}
                        onDelete={handleDeleteStudent}
                        onToggleFavorite={handleToggleFavorite}
                        tutorId={tutorId}
                        onStartLesson={handleStartLesson}
                        onMessage={handleMessage}
                      />
                    ))}
                  </div>
                </div>
              )}
              {/* Rest */}
              {filteredStudents.filter(s => !s.isFavorite).length > 0 && (
                <div className="list-section">
                  {filteredStudents.filter(s => s.isFavorite).length > 0 && (
                    <h2 className="list-section-title">Все ученики</h2>
                  )}
                  <div className="student-grid">
                    {filteredStudents.filter(s => !s.isFavorite).map(student => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        onClick={() => handleCardClick(student.id)}
                        onDelete={handleDeleteStudent}
                        onToggleFavorite={handleToggleFavorite}
                        tutorId={tutorId}
                        onStartLesson={handleStartLesson}
                        onMessage={handleMessage}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showInviteModal && isAuthenticated && (
        <InviteStudentModal
          tutorId={tutorId}
          tutorName={tutorName}
          students={students}
          anchorRef={inviteBtnRef}
          onClose={() => setShowInviteModal(false)}
          onStudentAdded={handleStudentAdded}
        />
      )}

      <Onboarding enabled={isAuthenticated} />
      <Footer />
    </div>
  );
}

export default Home;