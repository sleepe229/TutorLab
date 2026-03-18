import { useState, useEffect, useRef } from 'react';
import { chatApi } from '../services/api';

/**
 * Polls for unread message count every 30 seconds.
 * role: 'TUTOR' | 'STUDENT'
 * senderId: tutorId or studentAccountId
 * token: JWT (student only)
 */
export function useUnreadCount(role, senderId, token) {
  const [count, setCount] = useState(0);
  const timerRef = useRef(null);

  const loadCount = async () => {
    if (!senderId) return;
    try {
      const res = role === 'STUDENT'
        ? await chatApi.getStudentChats(senderId, token)
        : await chatApi.getTutorChats(senderId);
      const total = (res.data || []).reduce((sum, c) => {
        return sum + (role === 'STUDENT' ? (c.unreadCountStudent || 0) : (c.unreadCountTutor || 0));
      }, 0);
      setCount(total);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!senderId) return;
    loadCount();
    timerRef.current = setInterval(loadCount, 30000);
    return () => clearInterval(timerRef.current);
  }, [senderId, role, token]);

  return count;
}
