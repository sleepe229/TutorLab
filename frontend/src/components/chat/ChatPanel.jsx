import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { chatApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import { connectChatWs } from '../../services/chatWsClient.js';
import './ChatPanel.css';

/**
 * Chat panel for both tutor and student.
 *
 * Props:
 *   role: 'TUTOR' | 'STUDENT'
 *   senderId: tutorId or studentAccountId
 *   senderName: display name
 *   token: JWT (for student role only — tutor uses regular session token)
 *   onClose: () => void
 */
function ChatPanel({ role, senderId, senderName, token, onClose, inline = false, initialChatId = null }) {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const activeChatRef = useRef(null);
  activeChatRef.current = activeChat;

  const isStudent = role === 'STUDENT';

  // Load chat list
  useEffect(() => {
    loadChats();
  }, [senderId]);

  const loadChats = async (preOpenId = null) => {
    setLoading(true);
    try {
      const res = isStudent
        ? await chatApi.getStudentChats(senderId, token)
        : await chatApi.getTutorChats(senderId);
      const sorted = (res.data || []).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
      setChats(sorted);
      const targetId = preOpenId || initialChatId;
      const target = targetId ? sorted.find(c => c.id === targetId) : sorted[0];
      if (target && !activeChatRef.current) {
        openChat(target);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const openChat = useCallback(async (chat) => {
    // Disconnect previous WS
    if (wsRef.current) { wsRef.current.disconnect(); wsRef.current = null; }

    setActiveChat(chat);
    setMessages([]);

    try {
      const res = await chatApi.getMessages(chat.id);
      setMessages(res.data || []);
    } catch { /* silent */ }

    // Mark as read
    if (isStudent) chatApi.markReadStudent(chat.id, token).catch(() => {});
    else chatApi.markReadTutor(chat.id).catch(() => {});

    // Connect WS
    const ws = connectChatWs(chat.id, (msg) => {
      // Ignore echo of own messages (we optimistically add them)
      setMessages(prev => {
        // Deduplicate by id
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Scroll
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    wsRef.current = ws;
  }, [isStudent, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.disconnect(); };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !activeChat) return;
    setSending(true);
    setInput('');
    try {
      const res = await chatApi.sendMessage(activeChat.id, {
        senderId,
        senderRole: role,
        senderName,
        text,
        type: 'TEXT',
      });
      // Optimistically add (WS echo will be deduped)
      setMessages(prev => [...prev, res.data]);
      // Update chat's last message
      setChats(prev => prev.map(c =>
        c.id === activeChat.id ? { ...c, lastMessage: text, lastTimestamp: Date.now() } : c
      ).sort((a, b) => b.lastTimestamp - a.lastTimestamp));
    } catch {
      toast.error('Не удалось отправить сообщение');
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleSendInvite = async (studentId, studentName) => {
    if (!activeChat) return;
    try {
      const res = await chatApi.sendMessage(activeChat.id, {
        senderId,
        senderRole: role,
        senderName,
        text: `Приглашение присоединиться как ученик: ${studentName}`,
        type: 'INVITE',
        inviteStudentId: studentId,
      });
      setMessages(prev => [...prev, res.data]);
    } catch {
      toast.error('Не удалось отправить приглашение');
    }
  };

  // Expose sendInvite via ref for external use
  ChatPanel.sendInviteToActiveChat = handleSendInvite;

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Сегодня';
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getInitials = (name = '') => {
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`chat-panel${inline ? ' chat-panel--inline' : ''}`}>
      {/* Header — only shown in floating mode */}
      {!inline && (
        <div className="chat-panel__header">
          <span className="chat-panel__title">Сообщения</span>
          <button className="chat-panel__close" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
      )}

      <div className="chat-panel__body">
        {/* Chat list sidebar */}
        <div className="chat-list">
          {loading ? (
            <div className="chat-list__empty">Загрузка...</div>
          ) : chats.length === 0 ? (
            <div className="chat-list__empty">Нет диалогов</div>
          ) : (
            chats.map(chat => {
              const name = isStudent ? chat.tutorName : chat.studentName;
              const unread = isStudent ? chat.unreadCountStudent : chat.unreadCountTutor;
              return (
                <div
                  key={chat.id}
                  className={`chat-list__item${activeChat?.id === chat.id ? ' active' : ''}`}
                  onClick={() => openChat(chat)}
                >
                  <div className="chat-list__avatar">{getInitials(name)}</div>
                  <div className="chat-list__info">
                    <span className="chat-list__name">{name}</span>
                    {chat.lastMessage && (
                      <span className="chat-list__preview">{chat.lastMessage}</span>
                    )}
                  </div>
                  {unread > 0 && (
                    <span className="chat-list__badge">{unread}</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Messages area */}
        <div className="chat-messages">
          {!activeChat ? (
            <div className="chat-messages__empty">Выберите диалог</div>
          ) : (
            <>
              <div className="chat-messages__name">
                {isStudent ? activeChat.tutorName : activeChat.studentName}
              </div>
              <div className="chat-messages__list">
                {messages.map((msg, i) => {
                  const isMine = msg.senderId === senderId;
                  return (
                    <div key={msg.id || i} className={`chat-msg${isMine ? ' chat-msg--mine' : ''}`}>
                      {msg.type === 'INVITE' ? (
                        <div className="chat-msg__invite">
                          <span className="chat-msg__invite-icon">🎓</span>
                          <div>
                            <p className="chat-msg__invite-text">
                              {isMine ? 'Вы отправили приглашение' : `${msg.senderName} приглашает вас`}
                            </p>
                            {!isMine && msg.inviteStudentId && (
                              <a
                                href={`/invite/${msg.inviteStudentId}`}
                                className="btn btn-primary chat-msg__invite-btn"
                              >
                                Принять приглашение
                              </a>
                            )}
                          </div>
                          <span className="chat-msg__time">{formatTime(msg.timestamp)}</span>
                        </div>
                      ) : (
                        <div className="chat-msg__bubble">
                          <span className="chat-msg__text">{msg.text}</span>
                          <span className="chat-msg__time">{formatTime(msg.timestamp)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form className="chat-input-form" onSubmit={handleSend}>
                <input
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Написать сообщение..."
                  disabled={sending}
                  autoComplete="off"
                />
                <button type="submit" className="chat-send-btn" disabled={!input.trim() || sending} aria-label="Отправить">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
