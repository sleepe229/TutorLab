import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { chatApi, studentAccountApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import { connectChatWs } from '../../services/chatWsClient.js';
import './ChatPanel.css';

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Chat panel for both tutor and student.
 *
 * Props:
 *   role: 'TUTOR' | 'STUDENT'
 *   senderId: tutorId or studentAccountId
 *   senderName: display name
 *   token: JWT (for student role only)
 *   onClose: () => void
 *   inline: boolean
 *   initialChatId: string|null
 *   initialOpenStudentAccountId: string|null
 *   onNavigateToStudent: (studentAccountId) => void
 */
function ChatPanel({ role, senderId, senderName, token, onClose, inline = false,
  initialChatId = null, initialOpenStudentAccountId = null, onNavigateToStudent }) {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [declinedIds, setDeclinedIds] = useState(new Set());

  // Edit / delete
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { messageId, x, y }

  // Header ⋮ menu
  const [showChatMenu, setShowChatMenu] = useState(false);

  // Group sidebar
  const [showMembers, setShowMembers] = useState(false);

  // Create group modal
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]); // [{id, name}]
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fileInputRef = useRef(null);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const activeChatRef = useRef(null);
  activeChatRef.current = activeChat;

  const isStudent = role === 'STUDENT';

  // ── Load chats ──────────────────────────────────────────────────────────────

  useEffect(() => { loadChats(); }, [senderId]);

  const loadChats = async (preOpenId = null) => {
    setLoading(true);
    try {
      const [directRes, groupRes] = await Promise.all([
        isStudent
          ? chatApi.getStudentChats(senderId, token)
          : chatApi.getTutorChats(senderId),
        chatApi.getGroupsForParticipant(senderId, isStudent ? token : null),
      ]);
      const direct = directRes.data || [];
      const groups = groupRes.data || [];
      const all = [...direct, ...groups].sort((a, b) => b.lastTimestamp - a.lastTimestamp);
      setChats(all);
      const targetId = preOpenId || initialChatId;
      let target;
      if (targetId) {
        target = all.find(c => c.id === targetId);
      } else if (initialOpenStudentAccountId) {
        target = all.find(c => c.studentAccountId === initialOpenStudentAccountId);
      }
      if (!target) target = all[0];
      if (target && !activeChatRef.current) openChat(target);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // ── Open chat ───────────────────────────────────────────────────────────────

  const openChat = useCallback(async (chat) => {
    if (wsRef.current) { wsRef.current.disconnect(); wsRef.current = null; }
    setActiveChat(chat);
    setMessages([]);
    setShowMembers(false);
    setShowChatMenu(false);
    setEditingMessageId(null);
    setContextMenu(null);

    try {
      const res = await chatApi.getMessages(chat.id, isStudent ? token : null);
      setMessages(res.data || []);
    } catch { /* silent */ }

    if (isStudent) chatApi.markReadStudent(chat.id, token).catch(() => {});
    else chatApi.markReadTutor(chat.id).catch(() => {});
    setChats(prev => prev.map(c =>
      c.id === chat.id ? { ...c, unreadCountStudent: 0, unreadCountTutor: 0 } : c
    ));

    const ws = connectChatWs(chat.id, (raw) => {
      // Differentiate event types from plain messages
      if (raw.type === 'MESSAGE_EDITED') {
        setMessages(prev => prev.map(m => m.id === raw.message?.id ? raw.message : m));
      } else if (raw.type === 'MESSAGE_DELETED') {
        setMessages(prev => prev.map(m =>
          m.id === raw.messageId ? { ...m, deleted: true, text: '' } : m
        ));
      } else if (raw.type === 'MEMBER_ADDED') {
        // Refresh chat to get updated participant list
        chatApi.getMessages && loadChats(activeChatRef.current?.id);
      } else if (raw.type === 'MEMBER_REMOVED') {
        loadChats(activeChatRef.current?.id);
      } else if (raw.type === 'CHAT_BLOCKED') {
        setActiveChat(prev => prev ? { ...prev, blocked: true } : prev);
      } else {
        // Regular message
        setMessages(prev => {
          if (prev.some(m => m.id === raw.id)) return prev;
          return [...prev, raw];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    });
    wsRef.current = ws;
  }, [isStudent, token]);

  useEffect(() => () => { if (wsRef.current) wsRef.current.disconnect(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  // Close group picker on outside click
  useEffect(() => {
    if (!groupPickerOpen) return;
    const handler = (e) => {
      if (!e.target.closest('.group-picker')) setGroupPickerOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [groupPickerOpen]);

  // Close ⋮ chat menu on outside click
  useEffect(() => {
    if (!showChatMenu) return;
    const handler = (e) => {
      if (!e.target.closest('.chat-header-menu-wrap')) setShowChatMenu(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showChatMenu]);

  // ── Send / Edit ─────────────────────────────────────────────────────────────

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !activeChat) return;

    if (editingMessageId) {
      // Save edit
      setSending(true);
      try {
        const updated = await chatApi.editMessage(activeChat.id, editingMessageId, text, isStudent ? token : null);
        setMessages(prev => prev.map(m => m.id === editingMessageId ? updated.data : m));
        setEditingMessageId(null);
        setInput('');
      } catch (err) {
        const status = err?.response?.status;
        if (status === 422) toast.error('Время редактирования истекло (48ч)');
        else toast.error('Не удалось сохранить');
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    setInput('');
    try {
      const res = await chatApi.sendMessage(activeChat.id, {
        senderId,
        senderRole: role,
        senderName,
        text,
        type: 'TEXT',
      }, isStudent ? token : null);
      setMessages(prev => prev.some(m => m.id === res.data.id) ? prev : [...prev, res.data]);
      setTimeout(() => inputRef.current?.focus(), 0);
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

  const cancelEdit = () => { setEditingMessageId(null); setInput(''); };

  const handleSendInvite = async (studentId, studentName) => {
    if (!activeChat) return;
    try {
      const res = await chatApi.sendMessage(activeChat.id, {
        senderId, senderRole: role, senderName,
        text: `Приглашение присоединиться как ученик: ${studentName}`,
        type: 'INVITE',
        inviteStudentId: studentId,
      }, isStudent ? token : null);
      setMessages(prev => [...prev, res.data]);
    } catch {
      toast.error('Не удалось отправить приглашение');
    }
  };
  ChatPanel.sendInviteToActiveChat = handleSendInvite;

  // ── File upload ─────────────────────────────────────────────────────────────

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    e.target.value = '';
    setUploading(true);
    try {
      const result = await studentAccountApi.uploadChatFile(file);
      const fileUrl = result.fileUrl
        ? (result.fileUrl.startsWith('/api/') ? `${API_BASE}${result.fileUrl}` : result.fileUrl)
        : '';
      const fileName = result.fileName || file.name;
      const res = await chatApi.sendMessage(activeChat.id, {
        senderId, senderRole: role, senderName,
        text: fileName, type: 'FILE', fileUrl, fileName,
      }, isStudent ? token : null);
      setMessages(prev => prev.some(m => m.id === res.data.id) ? prev : [...prev, res.data]);
      setChats(prev => prev.map(c =>
        c.id === activeChat.id ? { ...c, lastMessage: `📎 ${fileName}`, lastTimestamp: Date.now() } : c
      ).sort((a, b) => b.lastTimestamp - a.lastTimestamp));
    } catch {
      toast.error('Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  };

  // ── Context menu: edit / delete ─────────────────────────────────────────────

  const handleMessageContextMenu = (e, msg) => {
    if (msg.senderId !== senderId || msg.deleted) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ messageId: msg.id, msgText: msg.text, timestamp: msg.timestamp, x: e.clientX, y: e.clientY });
  };

  const startEdit = (msg) => {
    setEditingMessageId(msg.messageId || msg.id);
    setInput(msg.msgText || '');
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleDeleteMessage = async (messageId) => {
    setContextMenu(null);
    if (!activeChat) return;
    try {
      await chatApi.deleteMessage(activeChat.id, messageId, isStudent ? token : null);
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, deleted: true, text: '' } : m
      ));
    } catch {
      toast.error('Не удалось удалить сообщение');
    }
  };

  // ── Block / Hide ────────────────────────────────────────────────────────────

  const handleBlock = async () => {
    if (!activeChat) return;
    setShowChatMenu(false);
    try {
      await chatApi.blockChat(activeChat.id, isStudent ? token : null);
      setActiveChat(prev => prev ? { ...prev, blockedByTutor: !isStudent, blockedByStudent: isStudent } : prev);
      toast.success('Пользователь заблокирован');
    } catch {
      toast.error('Не удалось заблокировать');
    }
  };

  const handleUnblock = async () => {
    if (!activeChat) return;
    setShowChatMenu(false);
    try {
      const res = await chatApi.unblockChat(activeChat.id, isStudent ? token : null);
      setActiveChat(res.data);
      toast.success('Блокировка снята');
    } catch {
      toast.error('Не удалось разблокировать');
    }
  };

  const handleHide = async () => {
    if (!activeChat) return;
    setShowChatMenu(false);
    try {
      await chatApi.hideChat(activeChat.id, isStudent ? token : null);
      setChats(prev => prev.filter(c => c.id !== activeChat.id));
      setActiveChat(null);
      setMessages([]);
      toast.success('Диалог скрыт');
    } catch {
      toast.error('Не удалось скрыть');
    }
  };

  // ── Group management ────────────────────────────────────────────────────────

  const handleLeaveGroup = async () => {
    if (!activeChat?.isGroup && activeChat?.type !== 'GROUP') return;
    setShowChatMenu(false);
    try {
      await chatApi.removeGroupMember(activeChat.id, senderId, isStudent ? token : null);
      setChats(prev => prev.filter(c => c.id !== activeChat.id));
      setActiveChat(null);
      setMessages([]);
      toast.success('Вы покинули группу');
    } catch {
      toast.error('Не удалось выйти из группы');
    }
  };

  const handleRemoveMember = async (participantId) => {
    if (!activeChat) return;
    try {
      const res = await chatApi.removeGroupMember(activeChat.id, participantId, isStudent ? token : null);
      setActiveChat(res.data);
    } catch {
      toast.error('Не удалось убрать участника');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const ids = selectedGroupMembers.map(m => m.id);
      const res = await chatApi.createGroup(newGroupName.trim(), ids, senderName, isStudent ? token : null);
      const newGroup = res.data;
      setChats(prev => [newGroup, ...prev]);
      setShowCreateGroup(false);
      setNewGroupName('');
      setSelectedGroupMembers([]);
      setGroupMemberSearch('');
      setGroupPickerOpen(false);
      openChat(newGroup);
    } catch {
      toast.error('Не удалось создать группу');
    } finally {
      setCreatingGroup(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

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

  const AVATAR_COLORS = ['#5B73F5','#e05252','#22c55e','#f59e0b','#a78bfa','#06b6d4','#ec4899','#84cc16','#f97316','#8b5cf6'];
  const avatarColor = (name = '') => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const groupCandidates = useMemo(() => {
    return chats
      .filter(c => c.type !== 'GROUP')
      .map(c => isStudent
        ? { id: c.tutorId, name: c.tutorName || 'Репетитор' }
        : { id: c.studentAccountId, name: c.studentName || 'Ученик' }
      )
      .filter(c => c.id && c.id !== senderId)
      .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
  }, [chats, isStudent, senderId]);

  const filteredCandidates = groupMemberSearch.trim()
    ? groupCandidates.filter(c => c.name.toLowerCase().includes(groupMemberSearch.toLowerCase()))
    : groupCandidates;

  const getChatDisplayName = (chat) => {
    if (chat.type === 'GROUP') return chat.groupName || 'Группа';
    return isStudent ? chat.tutorName : chat.studentName;
  };

  const isGroupChat = (chat) => chat?.type === 'GROUP';
  const isAdmin = (chat) => chat?.adminIds?.includes(senderId);
  const isBlocked = (chat) => chat?.blockedByTutor || chat?.blockedByStudent;

  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = null;
    messages.forEach(msg => {
      const d = formatDate(msg.timestamp);
      if (d !== lastDate) { groups.push({ type: 'separator', date: d }); lastDate = d; }
      groups.push({ type: 'message', msg });
    });
    return groups;
  }, [messages]);

  const nameMap = useMemo(() => {
    const map = {};
    if (senderId && senderName) map[senderId] = senderName;
    messages.forEach(m => { if (m.senderId && m.senderName) map[m.senderId] = m.senderName; });
    return map;
  }, [messages, senderId, senderName]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderMessage = (msg, i) => {
    const isMine = msg.senderId === senderId;
    const isDeclined = declinedIds.has(msg.id);
    const canEdit = isMine && !msg.deleted && (Date.now() - msg.timestamp < EDIT_WINDOW_MS);
    const canDelete = isMine && !msg.deleted;
    const showContextTrigger = canEdit || canDelete;

    return (
      <div
        key={msg.id || i}
        className={`chat-msg${isMine ? ' chat-msg--mine' : ''}`}
        onContextMenu={(e) => showContextTrigger && handleMessageContextMenu(e, msg)}
      >
        {isGroupChat(activeChat) && !isMine && (
          <span className="chat-msg__sender-name">{msg.senderName}</span>
        )}

        {msg.type === 'INVITE' ? (
          <div className="chat-msg__invite-card">
            <div className="chat-msg__invite-top">
              <span className="chat-msg__invite-icon">🎓</span>
              <div className="chat-msg__invite-body">
                <p className="chat-msg__invite-title">
                  {isMine ? 'Приглашение отправлено' : 'Приглашение к занятиям'}
                </p>
                <p className="chat-msg__invite-sub">
                  {isMine
                    ? `Ожидаем ответа от ${activeChat?.studentName || 'ученика'}`
                    : `${msg.senderName} приглашает вас в качестве ученика`}
                </p>
              </div>
            </div>
            {!isMine && !isDeclined && msg.inviteStudentId && (
              <div className="chat-msg__invite-actions">
                <a href={`/join/${msg.inviteStudentId}`} className="chat-invite-accept">Принять</a>
                <button type="button" className="chat-invite-decline"
                  onClick={() => setDeclinedIds(prev => new Set([...prev, msg.id]))}>
                  Отклонить
                </button>
              </div>
            )}
            {!isMine && isDeclined && (
              <p className="chat-msg__invite-declined">Приглашение отклонено</p>
            )}
            <span className="chat-msg__invite-time">{formatTime(msg.timestamp)}</span>
          </div>
        ) : msg.type === 'FILE' ? (
          <div className="chat-msg__bubble chat-msg__file">
            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
              download={msg.fileName} className="chat-msg__file-link">
              <span className="chat-msg__file-icon">📎</span>
              <span className="chat-msg__file-name">{msg.fileName || msg.text}</span>
            </a>
            <span className="chat-msg__time">{formatTime(msg.timestamp)}</span>
          </div>
        ) : msg.type === 'SYSTEM' ? (
          <div className="chat-msg__system">{msg.text}</div>
        ) : (
          <div
            className={`chat-msg__bubble${showContextTrigger ? ' chat-msg__bubble--interactive' : ''}`}
            onMouseDown={(e) => e.button === 0 && showContextTrigger && setContextMenu(null)}
          >
            {msg.deleted ? (
              <span className="chat-msg__deleted">Сообщение удалено</span>
            ) : (
              <>
                <span className="chat-msg__text">{msg.text}</span>
                {msg.editedAt && <span className="chat-msg__edited"> изменено</span>}
              </>
            )}
            <span className="chat-msg__time">{formatTime(msg.timestamp)}</span>
            {showContextTrigger && (
              <button
                className="chat-msg__menu-btn"
                onClick={(e) => { e.stopPropagation(); handleMessageContextMenu(e, msg); }}
                aria-label="Действия с сообщением"
              >⋯</button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`chat-panel${inline ? ' chat-panel--inline' : ''}`}>
      {!inline && (
        <div className="chat-panel__header">
          <span className="chat-panel__title">Сообщения</span>
          <button className="chat-panel__close" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
      )}

      <div className="chat-panel__body" data-has-active={activeChat ? 'true' : 'false'}>
        {/* Sidebar */}
        <div className="chat-list">
          <div className="chat-list__top">
            <button className="chat-list__new-group" onClick={() => setShowCreateGroup(true)} title="Создать группу">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          {loading ? (
            <div className="chat-list__empty">Загрузка...</div>
          ) : chats.length === 0 ? (
            <div className="chat-list__empty">Нет диалогов</div>
          ) : (
            chats.map(chat => {
              const name = getChatDisplayName(chat);
              const unread = isStudent ? chat.unreadCountStudent : chat.unreadCountTutor;
              return (
                <div
                  key={chat.id}
                  className={`chat-list__item${activeChat?.id === chat.id ? ' active' : ''}`}
                  onClick={() => openChat(chat)}
                >
                  <div className={`chat-list__avatar${chat.type === 'GROUP' ? ' chat-list__avatar--group' : ''}`}>
                    {chat.type === 'GROUP' ? '#' : getInitials(name)}
                  </div>
                  <div className="chat-list__info">
                    <span className="chat-list__name">{name}</span>
                    {chat.lastMessage && (
                      <span className="chat-list__preview">{chat.lastMessage}</span>
                    )}
                  </div>
                  {unread > 0 && <span className="chat-list__badge">{unread}</span>}
                </div>
              );
            })
          )}
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {!activeChat ? (
            <div className="chat-messages__empty">Выберите диалог</div>
          ) : (
            <>
              {/* Chat header */}
              <div className="chat-messages__header">
                <div className="chat-messages__header-left">
                  {/* Mobile: back to chat list */}
                  <button
                    className="chat-back-btn"
                    onClick={() => setActiveChat(null)}
                    aria-label="Назад к диалогам"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <span className="chat-messages__name">{getChatDisplayName(activeChat)}</span>
                  {isGroupChat(activeChat) && (
                    <span className="chat-messages__member-count">
                      {activeChat.participantIds?.length || 0} участников
                    </span>
                  )}
                </div>
                <div className="chat-messages__header-actions">
                  {isStudent && !isGroupChat(activeChat) && (
                    <button className="chat-profile-btn"
                      onClick={() => navigate(`/tutor/${activeChat.tutorId}`)}>
                      Профиль →
                    </button>
                  )}
                  {!isStudent && !isGroupChat(activeChat) && onNavigateToStudent && (
                    <button className="chat-profile-btn"
                      onClick={() => onNavigateToStudent(activeChat.studentAccountId)}>
                      Профиль →
                    </button>
                  )}
                  {isGroupChat(activeChat) && (
                    <button className="chat-profile-btn"
                      onClick={() => setShowMembers(v => !v)}>
                      Участники
                    </button>
                  )}
                  {/* ⋮ menu */}
                  <div className="chat-header-menu-wrap">
                    <button className="chat-header-menu-btn"
                      onClick={() => setShowChatMenu(v => !v)}
                      aria-label="Меню">⋮</button>
                    {showChatMenu && (
                      <div className="chat-header-menu">
                        {isGroupChat(activeChat) ? (
                          <button className="chat-header-menu__item chat-header-menu__item--danger"
                            onClick={handleLeaveGroup}>Покинуть группу</button>
                        ) : (
                          <>
                            {isBlocked(activeChat) ? (
                              <button className="chat-header-menu__item" onClick={handleUnblock}>
                                Разблокировать
                              </button>
                            ) : (
                              <button className="chat-header-menu__item chat-header-menu__item--danger"
                                onClick={handleBlock}>Заблокировать</button>
                            )}
                            <button className="chat-header-menu__item" onClick={handleHide}>
                              Скрыть диалог
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Members sidebar */}
              {showMembers && isGroupChat(activeChat) && (
                <div className="chat-members-panel">
                  <div className="chat-members-panel__title">Участники</div>
                  {(activeChat.participantIds || []).map(pid => (
                    <div key={pid} className="chat-members-panel__item">
                      <span className="chat-members-panel__name">{activeChat.participantNames?.[pid] || nameMap[pid] || pid}</span>
                      {activeChat.adminIds?.includes(pid) && (
                        <span className="chat-members-panel__admin">admin</span>
                      )}
                      {isAdmin(activeChat) && pid !== senderId && (
                        <button className="chat-members-panel__remove"
                          onClick={() => handleRemoveMember(pid)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Blocked banner */}
              {!isGroupChat(activeChat) && isBlocked(activeChat) && (
                <div className="chat-blocked-banner">
                  {activeChat.blockedByTutor && !isStudent && 'Вы заблокировали этого пользователя'}
                  {activeChat.blockedByStudent && isStudent && 'Вы заблокировали этого пользователя'}
                  {activeChat.blockedByTutor && isStudent && 'Вы заблокированы репетитором'}
                  {activeChat.blockedByStudent && !isStudent && 'Вы заблокированы учеником'}
                </div>
              )}

              {/* Message list */}
              <div className="chat-messages__list">
                {groupedMessages.map((item, i) => {
                  if (item.type === 'separator') {
                    return (
                      <div key={`sep-${item.date}`} className="chat-date-sep">
                        <span>{item.date}</span>
                      </div>
                    );
                  }
                  return renderMessage(item.msg, i);
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              {!isBlocked(activeChat) ? (
                <form className="chat-input-form" onSubmit={handleSend}>
                  {editingMessageId && (
                    <div className="chat-edit-bar">
                      <span>Редактирование</span>
                      <button type="button" onClick={cancelEdit} className="chat-edit-bar__cancel">✕</button>
                    </div>
                  )}
                  <div className="chat-input-row">
                    <input
                      ref={inputRef}
                      className="chat-input"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder={editingMessageId ? 'Редактировать сообщение...' : 'Написать сообщение...'}
                      disabled={sending || uploading}
                      autoComplete="off"
                    />
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
                    {!editingMessageId && (
                      <button type="button" className="chat-attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploading} aria-label="Прикрепить файл">
                        {uploading ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" strokeDasharray="30 10" strokeLinecap="round">
                              <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
                            </circle>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                        )}
                      </button>
                    )}
                    <button type="submit" className="chat-send-btn"
                      disabled={!input.trim() || sending || uploading} aria-label="Отправить">
                      {editingMessageId ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="chat-blocked-input">
                  {(activeChat.blockedByTutor && !isStudent) || (activeChat.blockedByStudent && isStudent)
                    ? <span>Вы заблокировали пользователя — <button className="chat-unblock-link" onClick={handleUnblock}>разблокировать</button></span>
                    : <span>Отправка сообщений недоступна</span>
                  }
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="chat-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {Date.now() - (contextMenu.timestamp || 0) < EDIT_WINDOW_MS && (
            <button className="chat-context-menu__item" onClick={() => startEdit(contextMenu)}>
              Редактировать
            </button>
          )}
          <button className="chat-context-menu__item chat-context-menu__item--danger"
            onClick={() => handleDeleteMessage(contextMenu.messageId)}>
            Удалить для всех
          </button>
        </div>
      )}

      {/* Create group modal */}
      {showCreateGroup && (
        <div className="chat-modal-overlay" onClick={() => {
          setShowCreateGroup(false);
          setNewGroupName('');
          setSelectedGroupMembers([]);
          setGroupMemberSearch('');
          setGroupPickerOpen(false);
        }}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <div className="chat-modal__title">Новая группа</div>
            <form onSubmit={handleCreateGroup}>
              <input
                className="chat-modal__input"
                placeholder="Название группы"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                required
                autoFocus
              />

              {/* Selected member chips */}
              {selectedGroupMembers.length > 0 && (
                <div className="group-picker-chips">
                  {selectedGroupMembers.map(m => (
                    <span key={m.id} className="group-picker-chip">
                      {m.name}
                      <button type="button" onClick={() =>
                        setSelectedGroupMembers(prev => prev.filter(x => x.id !== m.id))
                      }>×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Participant picker */}
              <div className="group-picker">
                <button
                  type="button"
                  className="group-picker__trigger"
                  onClick={e => { e.stopPropagation(); setGroupPickerOpen(v => !v); }}
                >
                  <span>
                    {selectedGroupMembers.length === 0
                      ? 'Добавить участников...'
                      : `Выбрано: ${selectedGroupMembers.length}`}
                  </span>
                  <svg
                    className={`group-picker__chevron${groupPickerOpen ? ' open' : ''}`}
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {groupPickerOpen && groupCandidates.length > 0 && (
                  <div className="group-picker__menu" onClick={e => e.stopPropagation()}>
                    <input
                      className="group-picker__search"
                      placeholder="Поиск..."
                      value={groupMemberSearch}
                      onChange={e => setGroupMemberSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="group-picker__list">
                      {filteredCandidates.length === 0 ? (
                        <div className="group-picker__empty">Не найдено</div>
                      ) : filteredCandidates.map(c => {
                        const selected = selectedGroupMembers.some(x => x.id === c.id);
                        return (
                          <button
                            type="button"
                            key={c.id}
                            className={`group-picker__item${selected ? ' selected' : ''}`}
                            onClick={() => setSelectedGroupMembers(prev =>
                              selected ? prev.filter(x => x.id !== c.id) : [...prev, c]
                            )}
                          >
                            <span className="group-picker__avatar"
                              style={{ background: avatarColor(c.name) }}>
                              {getInitials(c.name)}
                            </span>
                            <span className="group-picker__name">{c.name}</span>
                            {selected && <span className="group-picker__check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {groupCandidates.length === 0 && (
                  <p className="group-picker__hint">
                    Нет доступных контактов — сначала начните диалог с пользователем
                  </p>
                )}
              </div>

              <div className="chat-modal__actions">
                <button type="button" className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateGroup(false);
                    setNewGroupName('');
                    setSelectedGroupMembers([]);
                    setGroupMemberSearch('');
                    setGroupPickerOpen(false);
                  }}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={creatingGroup || !newGroupName.trim()}>
                  {creatingGroup ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPanel;
