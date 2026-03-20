import React from 'react';
import { useNavigate } from 'react-router-dom';
import TutorNav from '../ui/TutorNav';
import ChatPanel from './ChatPanel';
import './ChatPage.css';

/**
 * Full-page chat view at /chat
 * Props: role, senderId, senderName, token, onLogout (optional), backPath
 */
function ChatPage({ role, senderId, senderName, token, onLogout, backPath = '/home' }) {
  const navigate = useNavigate();

  return (
    <div className="chat-page">
      {role === 'TUTOR'
        ? <TutorNav tutorId={senderId} activePage="chat" onLogout={onLogout} />
        : (
          <header className="top-nav" role="banner">
            <div className="top-nav-inner">
              <div className="top-nav-brand" style={{ cursor: 'pointer' }} onClick={() => navigate(backPath)}>
                <div className="brand-logo-mark">TL</div>
                <span className="brand-name">TutorLab</span>
              </div>
              <nav className="top-nav-links">
                <button className="nav-link nav-link-btn" onClick={() => navigate(backPath)}>Кабинет</button>
                <span className="nav-link active">Сообщения</span>
              </nav>
              <div className="top-nav-actions">
                {onLogout && (
                  <button className="nav-icon-btn logout" onClick={onLogout} aria-label="Выйти" title="Выйти">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </header>
        )
      }

      <div className="chat-page__body">
        <ChatPanel
          role={role}
          senderId={senderId}
          senderName={senderName}
          token={token}
          inline
        />
      </div>
    </div>
  );
}

export default ChatPage;
