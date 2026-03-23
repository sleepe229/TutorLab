import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { chatApi } from '../../services/api';
import './InviteStudentModal.css';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#5B73F5', '#e05252', '#22c55e', '#f59e0b', '#a78bfa',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#8b5cf6',
];

function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Small popover near the "Пригласить ученика" button.
 * Props: tutorId, tutorName, students (existing), anchorRef, onClose, onStudentAdded
 */
function InviteStudentModal({ tutorId, tutorName, students = [], anchorRef, onClose, onStudentAdded }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (anchorRef?.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + window.scrollY + 8,
        right: window.innerWidth - r.right - window.scrollX,
      });
    }
  }, [anchorRef]);

  useEffect(() => {
    chatApi.getTutorChats(tutorId)
      .then(r => {
        const existingIds = new Set(students.map(s => s.studentAccountId).filter(Boolean));
        setChats((r.data || []).filter(c => !existingIds.has(c.studentAccountId)));
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen) setTimeout(() => searchRef.current?.focus(), 0);
  }, [dropdownOpen]);

  const inviteLink = `${window.location.origin}/join/${tutorId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const filteredChats = chats.filter(c =>
    c.studentName?.toLowerCase().includes(query.toLowerCase())
  );

  const selectChat = (chat) => {
    setSelectedChat(chat);
    setDropdownOpen(false);
    setQuery('');
  };

  const sendInviteToChat = async () => {
    if (!selectedChat) { toast.error('Выберите собеседника'); return; }
    setSending(true);
    try {
      await chatApi.sendMessage(selectedChat.id, {
        senderId: tutorId,
        senderRole: 'TUTOR',
        senderName: tutorName,
        text: `Приглашение присоединиться к занятиям: ${inviteLink}`,
        type: 'INVITE',
        inviteStudentId: tutorId,
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
          <p className="invite-pop__empty">Нет подходящих собеседников<br/><span>Используйте ссылку выше</span></p>
        ) : (
          <>
            {/* Custom dropdown trigger */}
            <div className="invite-dropdown" ref={dropdownRef}>
              <button
                type="button"
                className={`invite-dropdown__trigger${dropdownOpen ? ' invite-dropdown__trigger--open' : ''}`}
                onClick={() => setDropdownOpen(v => !v)}
              >
                {selectedChat ? (
                  <span className="invite-dropdown__selected">
                    <span
                      className="invite-dropdown__avatar"
                      style={{ background: avatarColor(selectedChat.studentName) }}
                    >
                      {getInitials(selectedChat.studentName)}
                    </span>
                    <span className="invite-dropdown__name">{selectedChat.studentName}</span>
                  </span>
                ) : (
                  <span className="invite-dropdown__placeholder">Выберите собеседника…</span>
                )}
                <svg className="invite-dropdown__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {dropdownOpen && (
                <div className="invite-dropdown__menu">
                  <div className="invite-dropdown__search-wrap">
                    <input
                      ref={searchRef}
                      className="invite-dropdown__search"
                      placeholder="Начните вводить имя…"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="invite-dropdown__list">
                    {filteredChats.length === 0 ? (
                      <div className="invite-dropdown__empty">Ничего не найдено</div>
                    ) : filteredChats.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className={`invite-dropdown__item${selectedChat?.id === c.id ? ' invite-dropdown__item--active' : ''}`}
                        onClick={() => selectChat(c)}
                      >
                        <span
                          className="invite-dropdown__avatar"
                          style={{ background: avatarColor(c.studentName) }}
                        >
                          {getInitials(c.studentName)}
                        </span>
                        <span className="invite-dropdown__item-name">{c.studentName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedChat && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 10, width: '100%' }}
                onClick={sendInviteToChat}
                disabled={sending}
              >
                {sending ? 'Отправляем…' : 'Отправить приглашение'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InviteStudentModal;
