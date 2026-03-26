import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentAccountApi, studentApi, chatApi } from '../../services/api';
import RegistrationChat from '../registration/RegistrationChat';

function InviteHandler({ studentAccountId }) {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // 'idle' | 'linking' | 'done' | 'already' | 'error'

  const sendWelcomeMessage = async (token, accountId, name) => {
    try {
      const { data: profile } = await studentApi.getStudentPublic(studentId);
      if (!profile?.tutorId) return;
      const { data: chat } = await chatApi.getOrCreateAsStudent(
        profile.tutorId, accountId, name, token
      );
      await chatApi.sendMessage(chat.id, {
        senderRole: 'STUDENT',
        senderName: name,
        text: `${name} стал Вашим учеником`,
        type: 'system',
      }, token);
    } catch { /* non-critical */ }
  };

  const doLink = async (token, accountId) => {
    setStatus('linking');
    try {
      await studentAccountApi.link(token, studentId);
      localStorage.setItem('linkedStudentId', studentId);
      setStatus('done');
      const firstName = localStorage.getItem('studentFirstName') || '';
      const lastName = localStorage.getItem('studentLastName') || '';
      const name = `${firstName} ${lastName}`.trim() || 'Ученик';
      sendWelcomeMessage(token, accountId, name);
    } catch (err) {
      if (err?.response?.status === 409) {
        setStatus('already');
      } else {
        setStatus('error');
      }
    }
  };

  // Auto-link if already authenticated as student
  useEffect(() => {
    if (studentAccountId) {
      const token = localStorage.getItem('studentToken');
      if (token) doLink(token, studentAccountId);
    }
  }, [studentAccountId]);

  if (status === 'linking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-secondary)' }}>
        Привязываем профиль...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '16px' }}>Не удалось привязать профиль. Попробуйте ещё раз.</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const t = localStorage.getItem('studentToken');
              if (t) doLink(t);
            }}
          >
            Повторить попытку
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/me')}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (status === 'done' || status === 'already') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: '40px 32px', maxWidth: 400, width: '90%', textAlign: 'center', boxShadow: '0 4px 32px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            {status === 'already' ? 'Вы уже добавлены!' : 'Вы успешно добавлены!'}
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {status === 'already'
              ? 'Этот профиль ученика уже привязан к вашему аккаунту.'
              : 'Профиль ученика успешно привязан к вашему аккаунту.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/s/${studentId}`)}
            >
              Перейти к профилю
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/me')}
            >
              Мой кабинет
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (studentAccountId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-secondary)' }}>
        Загрузка...
      </div>
    );
  }

  // Not logged in — show registration, then link
  const handleRegister = async (data) => {
    const { studentAccountId: sid, accessToken, refreshToken } = data;
    if (sid) localStorage.setItem('studentAccountId', sid);
    if (accessToken) localStorage.setItem('studentToken', accessToken);
    if (refreshToken) localStorage.setItem('studentRefreshToken', refreshToken);
    if (data.firstName) localStorage.setItem('studentFirstName', data.firstName);
    if (data.lastName !== undefined) localStorage.setItem('studentLastName', data.lastName || '');

    if (accessToken) {
      try {
        await studentAccountApi.link(accessToken, studentId);
        localStorage.setItem('linkedStudentId', studentId);
        toast.success('Вы добавлены как ученик!');
        const firstName = data.firstName || '';
        const lastName = data.lastName || '';
        const name = `${firstName} ${lastName}`.trim() || 'Ученик';
        sendWelcomeMessage(accessToken, sid, name);
      } catch { /* already linked or error — still proceed */ }
    }
    // Hard-navigate so App re-mounts with localStorage values, avoiding React state race
    window.location.replace(`/s/${studentId}`);
  };

  return (
    <RegistrationChat
      role="student"
      onRegister={handleRegister}
      onBack={() => navigate('/home')}
    />
  );
}

export default InviteHandler;
