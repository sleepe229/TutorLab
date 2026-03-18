import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { API_BASE } from './config.js';
import RegistrationChat from './components/registration/RegistrationChat';
import Home from './components/home/Home';
import Settings from './components/settings/Settings';
import StudentDetail from './components/student/StudentDetail';
import LiveLessonTeacher from './components/live/LiveLessonTeacher';
import LiveLessonStudent from './components/live/LiveLessonStudent';
import Schedule from './components/schedule/Schedule';
import StudentView from './components/studentview/StudentView';
import StudentDashboard from './components/studentdashboard/StudentDashboard';
import InviteHandler from './components/invite/InviteHandler';
import ChatPage from './components/chat/ChatPage';
import JoinTutor from './components/join/JoinTutor';
import TutorMarketplace from './components/marketplace/TutorMarketplace';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './App.css';

/** Landing: choose role before showing the auth chat */
function RoleChoice({ onSelect }) {
  return (
    <div className="role-choice-overlay">
      <div className="role-choice-card">
        <div className="role-choice-logo">
          <div className="brand-logo-mark" style={{ width: 48, height: 48, fontSize: 18, borderRadius: 12, background: '#5B73F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>TL</div>
          <h1 className="role-choice-title">TutorLab</h1>
        </div>
        <p className="role-choice-sub">Выберите, как вы хотите войти</p>
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
    </div>
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
          element={tutorId ? <Home tutorId={tutorId} onLogout={handleTutorLogout} /> : renderLanding()}
        />
        <Route
          path="/settings"
          element={tutorId ? <Settings tutorId={tutorId} onBack={() => navigate('/home')} /> : <Navigate to="/home" replace />}
        />
        <Route
          path="/student/:id"
          element={tutorId ? <StudentDetail tutorId={tutorId} /> : <Navigate to="/home" replace />}
        />
        <Route
          path="/live/teacher"
          element={tutorId ? <LiveLessonTeacher tutorId={tutorId} /> : <Navigate to="/home" replace />}
        />
        <Route path="/live/student/:sessionId" element={<LiveLessonStudent />} />
        <Route
          path="/schedule"
          element={tutorId ? <Schedule tutorId={tutorId} onLogout={handleTutorLogout} /> : <Navigate to="/home" replace />}
        />
        <Route
          path="/me"
          element={
            studentAccountId
              ? <StudentDashboard studentAccountId={studentAccountId} onLogout={handleStudentLogout} />
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
              ? <ChatPage role="TUTOR" senderId={tutorId} senderName={''} onLogout={handleTutorLogout} backPath="/home" />
              : studentAccountId
                ? <ChatPage
                    role="STUDENT"
                    senderId={studentAccountId}
                    senderName={`${localStorage.getItem('studentFirstName') || ''} ${localStorage.getItem('studentLastName') || ''}`.trim()}
                    token={localStorage.getItem('studentToken')}
                    onLogout={handleStudentLogout}
                    backPath="/me"
                  />
                : <Navigate to="/home" replace />
          }
        />
        {/* General tutor invite link — anyone visiting gets added as student */}
        <Route
          path="/join/:tutorId"
          element={
            <JoinTutor
              studentAccountId={studentAccountId}
              onStudentAuth={handleStudentAuth}
            />
          }
        />
        {/* Tutor marketplace — accessible to everyone */}
        <Route path="/tutors" element={<TutorMarketplace studentAccountId={studentAccountId} />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
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
