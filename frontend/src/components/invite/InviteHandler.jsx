import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentAccountApi } from '../../services/api';
import RegistrationChat from '../registration/RegistrationChat';

/**
 * Handles /invite/:studentId
 * - If already logged in as student → auto-link and go to /me
 * - Otherwise → show student registration/login chat, then auto-link after auth
 */
function InviteHandler({ studentAccountId, onStudentAuth }) {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);

  const doLink = async (token) => {
    setLinking(true);
    try {
      await studentAccountApi.link(token, studentId);
      localStorage.setItem('linkedStudentId', studentId);
      setLinked(true);
      toast.success('Профиль привязан!');
      navigate('/me');
    } catch {
      // Already linked or other error — still go to /me
      navigate('/me');
    } finally {
      setLinking(false);
    }
  };

  // Auto-link if already authenticated as student
  useEffect(() => {
    if (studentAccountId && !linking && !linked) {
      const token = localStorage.getItem('studentToken');
      if (token) doLink(token);
    }
  }, [studentAccountId]);

  if (linking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-secondary)' }}>
        Привязываем профиль...
      </div>
    );
  }

  if (studentAccountId) {
    return null; // handled by useEffect
  }

  // Not logged in — show registration, then link
  const handleRegister = async (data) => {
    onStudentAuth(data);
    // After auth, the token is now in localStorage
    const token = localStorage.getItem('studentToken');
    if (token) await doLink(token);
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
