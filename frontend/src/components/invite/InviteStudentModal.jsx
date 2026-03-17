import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { chatApi } from '../../services/api';
import './InviteStudentModal.css';

/**
 * Small popover near the "Пригласить ученика" button.
 * Options:
 *   1. Copy invite link  /join/{tutorId}
 *   2. Send invite in chat — pick a chat contact who is NOT yet a student of this tutor
 *
 * Props: tutorId, tutorName, students (existing), anchorRef, onClose, onStudentAdded
 */
function InviteStudentModal({ tutorId, tutorName, students = [], anchorRef, onClose, onStudentAdded }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  // Position below the anchor button
  useEffect(() => {
    if (anchorRef?.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + window.scrollY + 8,
        right: window.innerWidth - r.right - window.scrollX,
      });
    }
  }, [anchorRef]);

  // Load chats, filter to only contacts who are NOT already a student
  useEffect(() => {
    chatApi.getTutorChats(tutorId)
      .then(r => {
        const existingStudentAccountIds = new Set(
          students.map(s => s.studentAccountId).filter(Boolean)
        );
        const nonStudentChats = (r.data || []).filter(
          c => !existingStudentAccountIds.has(c.studentAccountId)
        );
        setChats(nonStudentChats);
      })
      .catch(() => {});
  }, [tutorId, students]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        anchorRef?.current && !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  const inviteLink = `${window.location.origin}/join/${tutorId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sendInviteToChat = async () => {
    if (!selectedChat) { toast.error('Выберите чат'); return; }
    setSending(true);
    try {
      await chatApi.sendMessage(selectedChat.id, {
        senderId: tutorId,
        senderRole: 'TUTOR',
        senderName: tutorName,
        text: `Приглашение присоединиться к занятиям: ${inviteLink}`,
        type: 'INVITE',
        inviteStudentId: null,
      });
      toast.success('Приглашение отправлено');
      onClose();
    } catch {
      toast.error('Не удалось отправить приглашение');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="invite-popover"
      ref={popoverRef}
      style={{ top: pos.top, right: pos.right }}
      role="dialog"
      aria-label="Пригласить ученика"
    >
      <div className="invite-pop__header">
        <span className="invite-pop__title">Пригласить ученика</span>
        <button className="invite-pop__close" onClick={onClose} aria-label="Закрыть">✕</button>
      </div>

      {/* Copy link */}
      <div className="invite-pop__section">
        <p className="invite-pop__label">Ссылка-приглашение</p>
        <p className="invite-pop__hint">Ученик перейдёт по ссылке и сразу попадёт к вам</p>
        <div className="invite-pop__link-row">
          <input
            className="invite-pop__link-input"
            value={inviteLink}
            readOnly
            onFocus={e => e.target.select()}
          />
          <button
            className={`btn btn-primary${copied ? ' btn-copied' : ''}`}
            onClick={copyLink}
          >
            {copied ? '✓' : 'Копировать'}
          </button>
        </div>
      </div>

      {/* Send via chat */}
      <div className="invite-pop__section">
        <p className="invite-pop__label">Отправить в чат</p>
        {chats.length === 0 ? (
          <p className="invite-pop__empty">Нет подходящих чатов<br/><span>Ссылку можно скопировать выше</span></p>
        ) : (
          <>
            <select
              className="invite-pop__select"
              value={selectedChat?.id || ''}
              onChange={e => setSelectedChat(chats.find(c => c.id === e.target.value) || null)}
            >
              <option value="">Выберите собеседника...</option>
              {chats.map(c => (
                <option key={c.id} value={c.id}>{c.studentName}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              style={{ marginTop: 8, width: '100%' }}
              onClick={sendInviteToChat}
              disabled={!selectedChat || sending}
            >
              {sending ? 'Отправляем...' : 'Отправить приглашение'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default InviteStudentModal;
