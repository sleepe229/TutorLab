import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { API_BASE } from './config.js';
import RegistrationChat from './components/registration/RegistrationChat';
import Home from './components/home/Home';
import Settings from './components/settings/Settings';
import StudentDetail from './components/student/StudentDetail';
import Schedule from './components/schedule/Schedule';
import StudentView from './components/studentview/StudentView';
import InviteHandler from './components/invite/InviteHandler';
import Footer from './components/ui/Footer';
import JoinTutor from './components/join/JoinTutor';
import TutorMarketplace from './components/marketplace/TutorMarketplace';
import TutorProfilePage from './components/tutor/TutorProfilePage';
import PrivacyPage from './components/legal/PrivacyPage';
import TermsPage from './components/legal/TermsPage';
import AboutPage from './components/about/AboutPage';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './App.css';

// Lazy-load components that pull in heavy deps (stompjs/sockjs/simple-peer)
const LiveLessonTeacher = lazy(() => import('./components/live/LiveLessonTeacher'));
const LiveLessonStudent = lazy(() => import('./components/live/LiveLessonStudent'));
const ChatPage = lazy(() => import('./components/chat/ChatPage'));
// StudentDashboard imports wsClient which statically imports stompjs/sockjs — lazy to keep stomp out of entry chunk
const StudentDashboard = lazy(() => import('./components/studentdashboard/StudentDashboard'));

/** Landing: choose role before showing the auth chat */
function RoleChoice({ onSelect }) {
  return (
    <div className="role-choice-overlay">
      <Helmet>
        <title>TutorLab — онлайн-платформа для репетиторов</title>
        <meta name="description" content="TutorLab — инструмент для репетиторов: управление учениками, онлайн-уроки с интерактивной доской, PDF-слайды и расписание занятий." />
        <link rel="canonical" href="https://tutorlab.onrender.com/" />
      </Helmet>
      <div className="role-choice-card">
        <div className="role-choice-logo">
          <div className="brand-logo-mark" style={{ width: 48, height: 48, fontSize: 18, borderRadius: 12, background: '#5B73F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>TL</div>
          <h1 className="role-choice-title">TutorLab</h1>
        </div>
        <p className="role-choice-sub">Управляйте учениками, проводите онлайн-уроки с интерактивной доской и находите студентов через маркетплейс репетиторов.</p>
        <div className="role-choice-buttons">
          <button className="role-btn role-btn-tutor" onClick={() => onSelect('tutor')}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Я преподаватель</span>
          </button>
          <button className="role-btn role-btn-student" onClick={() => onSelect('student')}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
            <span>Я ученик</span>
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

/** Shared noindex meta for all authenticated-only routes */
function NoIndexMeta() {
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}

function AppContent() {
  const [tutorId, setTutorId] = useState(localStorage.getItem('tutorId'));
  const [studentAccountId, setStudentAccountId] = useState(localStorage.getItem('studentAccountId'));
  const [authRole, setAuthRole] = useState(null); // 'tutor' | 'student' — chosen on landing
  const navigate = useNavigate();

  const handleTutorAuth = (data) => {
    const id = typeof data === 'string' ? data : data.id;
    const accessToken = typeof data === 'object' ? (data.sessionToken || data.accessToken) : null;
    const refreshToken = typeof data === 'object' ? data.refreshToken : null;
    setTutorId(id);
    localStorage.setItem('tutorId', id);
    if (accessToken) localStorage.setItem('sessionToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setAuthRole(null);
    navigate('/home');
  };

  const handleStudentAuth = (data) => {
    const { studentAccountId: sid, accessToken, refreshToken } = data;
    setStudentAccountId(sid);
    localStorage.setItem('studentAccountId', sid);
    if (accessToken) localStorage.setItem('studentToken', accessToken);
    if (refreshToken) localStorage.setItem('studentRefreshToken', refreshToken);
    if (data.firstName) localStorage.setItem('studentFirstName', data.firstName);
    if (data.lastName !== undefined) localStorage.setItem('studentLastName', data.lastName || '');
    setAuthRole(null);
    navigate('/me');
  };

  const handleTutorLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try { await axios.post(`${API_BASE}/api/auth/logout`, { refreshToken }); } catch {}
    }
    setTutorId(null);
    ['tutorId', 'sessionToken', 'refreshToken'].forEach(k => localStorage.removeItem(k));
  };

  const handleStudentLogout = async () => {
    const refreshToken = localStorage.getItem('studentRefreshToken');
    if (refreshToken) {
      try { await axios.post(`${API_BASE}/api/students/auth/logout`, { refreshToken }); } catch {}
    }
    setStudentAccountId(null);
    ['studentAccountId', 'studentToken', 'studentRefreshToken', 'studentFirstName', 'studentLastName']
      .forEach(k => localStorage.removeItem(k));
    navigate('/tutors');
  };

  // Landing: not logged in as either role
  const renderLanding = () => {
    if (authRole === 'tutor') {
      return <RegistrationChat role="tutor" onRegister={handleTutorAuth} onBack={() => setAuthRole(null)} />;
    }
    if (authRole === 'student') {
      return <RegistrationChat role="student" onRegister={handleStudentAuth} onBack={() => setAuthRole(null)} />;
    }
    return <RoleChoice onSelect={setAuthRole} />;
  };

  return (
    <div className="App">
      <Routes>
        <Route
          path="/home"
          element={
            tutorId ? (
              <><NoIndexMeta /><Home tutorId={tutorId} onLogout={handleTutorLogout} /></>
            ) : studentAccountId && !authRole ? (
              <Navigate to="/me" replace />
            ) : renderLanding()
          }
        />
        <Route
          path="/settings"
          element={tutorId ? (
            <><NoIndexMeta /><Settings tutorId={tutorId} onBack={() => navigate('/home')} onLogout={handleTutorLogout} /></>
          ) : <Navigate to="/home" replace />}
        />
        <Route
          path="/student/:id"
          element={tutorId ? (
            <><NoIndexMeta /><StudentDetail tutorId={tutorId} /></>
          ) : <Navigate to="/home" replace />}
        />
        <Route
          path="/live/teacher"
          element={tutorId ? (
            <Suspense fallback={null}>
              <NoIndexMeta />
              <LiveLessonTeacher tutorId={tutorId} />
            </Suspense>
          ) : <Navigate to="/home" replace />}
        />
        <Route
          path="/live/student/:sessionId"
          element={
            <Suspense fallback={null}>
              <NoIndexMeta />
              <LiveLessonStudent />
            </Suspense>
          }
        />
        <Route
          path="/schedule"
          element={tutorId ? (
            <><NoIndexMeta /><Schedule tutorId={tutorId} onLogout={handleTutorLogout} /></>
          ) : <Navigate to="/home" replace />}
        />
        <Route
          path="/me"
          element={
            studentAccountId
              ? (
                <Suspense fallback={null}>
                  <NoIndexMeta />
                  <StudentDashboard studentAccountId={studentAccountId} onLogout={handleStudentLogout} />
                </Suspense>
              )
              : <Navigate to="/tutors" replace />
          }
        />
        {/* Public student cabinet — accessible by anyone with the link */}
        <Route path="/s/:studentId" element={<StudentView studentAccountId={studentAccountId} />} />
        {/* Invite link — auto-links student profile on visit */}
        <Route
          path="/invite/:studentId"
          element={
            <InviteHandler
              studentAccountId={studentAccountId}
              onStudentAuth={handleStudentAuth}
            />
          }
        />
        {/* Chat page */}
        <Route
          path="/chat"
          element={
            tutorId
              ? (
                <Suspense fallback={null}>
                  <NoIndexMeta />
                  <ChatPage role="TUTOR" senderId={tutorId} senderName={''} onLogout={handleTutorLogout} backPath="/home" />
                </Suspense>
              )
              : studentAccountId
                ? (
                  <Suspense fallback={null}>
                    <NoIndexMeta />
                    <ChatPage
                      role="STUDENT"
                      senderId={studentAccountId}
                      senderName={`${localStorage.getItem('studentFirstName') || ''} ${localStorage.getItem('studentLastName') || ''}`.trim()}
                      token={localStorage.getItem('studentToken')}
                      onLogout={handleStudentLogout}
                      backPath="/me"
                    />
                  </Suspense>
                )
                : <Navigate to="/home" replace />
          }
        />
        {/* General tutor invite link — noindex (ephemeral invite, not SEO-relevant) */}
        <Route
          path="/join/:tutorId"
          element={
            <>
              <NoIndexMeta />
              <JoinTutor
                studentAccountId={studentAccountId}
                onStudentAuth={handleStudentAuth}
              />
            </>
          }
        />
        {/* Tutor marketplace — accessible to everyone */}
        <Route path="/tutors" element={<TutorMarketplace studentAccountId={studentAccountId} />} />
        {/* Tutor public profile card — accessible to everyone */}
        <Route path="/tutor/:id" element={<TutorProfilePage studentAccountId={studentAccountId} />} />

        {/* Legal and about pages */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/about" element={<AboutPage />} />

        <Route path="/" element={<Navigate to={studentAccountId ? '/me' : '/home'} replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </Router>
  );
}

export default App;