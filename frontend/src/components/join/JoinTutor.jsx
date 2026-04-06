import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { tutorApi, joinApi, chatApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import RegistrationChat from '../registration/RegistrationChat';
import './JoinTutor.css';

/**
 * /join/:tutorId
 * - Student visits a general tutor invite link
 * - If already logged in as student → call /api/join/{tutorId} → creates student profile + links
 * - If not logged in → show RegistrationChat(role='student') → then join
 */
function JoinTutor({ studentAccountId, onStudentAuth }) {
  const { tutorId } = useParams();
  const navigate = useNavigate();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    tutorApi.getTutorProfile(tutorId)
      .then(r => setTutor(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tutorId]);

  const doJoin = async (token) => {
    setJoining(true);
    try {
      await joinApi.joinTutor(tutorId, token);
      // Auto-create chat so it appears immediately in Сообщения
      try {
        const accountId = localStorage.getItem('studentAccountId');
        const firstName = localStorage.getItem('studentFirstName') || '';
        const lastName = localStorage.getItem('studentLastName') || '';
        const name = `${firstName} ${lastName}`.trim() || 'Ученик';
        if (accountId) await chatApi.getOrCreateAsStudent(tutorId, accountId, name, token);
      } catch { /* non-critical */ }
      setJoined(true);
      toast.success('Вы добавлены к репетитору!');
      setTimeout(() => navigate('/me'), 1500);
    } catch {
      toast.error('Не удалось присоединиться. Попробуйте позже.');
      setJoining(false);
    }
  };

  // Auto-join if already authenticated
  useEffect(() => {
    if (studentAccountId && !joining && !joined && !loading) {
      const token = localStorage.getItem('studentToken');
      if (token) doJoin(token);
    }
  }, [studentAccountId, loading]);

  const handleStudentAuth = async (data) => {
    onStudentAuth(data);
    // Token is now in localStorage
    setTimeout(() => {
      const token = localStorage.getItem('studentToken');
      if (token) doJoin(token);
    }, 100);
  };

  const getPhotoUrl = (url) => url
    ? (url.startsWith('/api/') ? `${API_BASE}${url}` : url)
    : null;

  if (loading) {
    return (
      <div className="join-container">
        <div className="join-loading">Загрузка...</div>
      </div>
    );
  }

  // Show joining / joined state (check before !tutor so auto-join doesn't flash error screen)
  if (joining || joined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <div className="join-spinner" />
          <p>{joined ? 'Готово! Переходим в ваш кабинет...' : 'Добавляем вас к репетитору...'}</p>
        </div>
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="join-container">
        <div className="join-error">
          <h2>Ссылка недействительна</h2>
          <p>Репетитор не найден.</p>
          <button className="btn btn-primary" onClick={() => navigate('/home')}>На главную</button>
        </div>
      </div>
    );
  }

  // Not logged in — show registration
  if (!studentAccountId) {
    const photo = getPhotoUrl(tutor.photoUrl);
    return (
      <div className="join-container">
        <div className="join-tutor-banner">
          {photo
            ? <img src={photo} alt={tutor.fullName} className="join-tutor-avatar" />
            : <div className="join-tutor-avatar-ph">{(tutor.fullName || '?')[0]}</div>
          }
          <div>
            <h2 className="join-tutor-name">{tutor.fullName}</h2>
            <p className="join-tutor-invite">приглашает вас заниматься на TutorLab</p>
          </div>
        </div>
        <RegistrationChat
          role="student"
          onRegister={handleStudentAuth}
          onBack={() => navigate('/home')}
        />
      </div>
    );
  }

  return null;
}

export default JoinTutor;
