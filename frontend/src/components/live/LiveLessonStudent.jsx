// src/components/live/LiveLessonStudent.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectToSession } from '../../services/wsClient';
import { WebRTCService, fetchIceServers } from '../../services/webrtcService';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { API_BASE } from '../../config.js';
import {
  IconMic, IconCamera, IconMuteOff, IconMuteOn,
} from './liveIcons.jsx';
import './LiveLesson.css';

const CANVAS_W = 1200;
const CANVAS_H = 675;

function mediaErrorMessage(rtc, type) {
  if (rtc.lastError === 'permission') return `Разрешите доступ к ${type} в настройках браузера`;
  if (rtc.lastError === 'in-use') return `${type === 'камере' ? 'Камера' : 'Микрофон'} используется другим приложением`;
  if (rtc.lastError === 'peer') return 'Ошибка WebRTC. Попробуйте ещё раз';
  return `Нет доступа к ${type}`;
}

function LiveLessonStudent() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [teacherMediaConnected, setTeacherMediaConnected] = useState(false);
  // true while teacher's video/screen track is active (not muted/null)
  const [teacherVideoActive, setTeacherVideoActive] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pointerFraction, setPointerFraction] = useState(null);

  // 'pdf' | 'teacher' | 'local' | null
  const [focusedView, setFocusedView] = useState(null);

  const teacherRtcRef = useRef(null);
  const studentRtcRef = useRef(null);
  // Main-area video refs
  const teacherVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  // Sidebar tile video refs
  const sidebarTeacherVideoRef = useRef(null);
  const sidebarLocalVideoRef = useRef(null);

  const teacherStreamRef = useRef(null);
  const clientRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerTimeoutRef = useRef(null);
  // ICE servers fetched once and reused for all peers in this session
  const iceServersRef = useRef(null);

  const presentationRef = useRef(presentation);
  useEffect(() => { presentationRef.current = presentation; }, [presentation]);

  const isAudioEnabledRef = useRef(isAudioEnabled);
  const isVideoEnabledRef = useRef(isVideoEnabled);
  useEffect(() => { isAudioEnabledRef.current = isAudioEnabled; }, [isAudioEnabled]);
  useEffect(() => { isVideoEnabledRef.current = isVideoEnabled; }, [isVideoEnabled]);

  // ── Sync local stream to both main and sidebar video elements ────────
  useEffect(() => {
    const stream = studentRtcRef.current ? studentRtcRef.current.getLocalStream() : null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      if (stream) localVideoRef.current.play().catch(() => {});
    }
    if (sidebarLocalVideoRef.current) {
      sidebarLocalVideoRef.current.srcObject = stream;
      if (stream) sidebarLocalVideoRef.current.play().catch(() => {});
    }
  }, [isVideoEnabled, focusedView]);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch ICE servers once; reused for every WebRTC peer in this session
        iceServersRef.current = await fetchIceServers();

        const res = await api.get(`/live/sessions/${sessionId}`);
        setSession(res.data);

        try {
          const presRes = await api.get(`/live/sessions/${sessionId}/presentation`);
          setPresentation(presRes.data);
          setCurrentSlide(presRes.data.currentSlide || 0);
          setFocusedView('pdf');
        } catch {
          // No presentation yet
        }

        const wsClient = connectToSession(sessionId, {
          onConnect: () => {
            // Announce presence so teacher sees student tile immediately
            setTimeout(() => wsClient.sendPresence('student'), 300);
          },
          onWebRTC: handleWebRTCSignal,
          onSlideChange: (data) => setCurrentSlide(data.slideIndex),
          onPresentationUpdate: (data) => {
            setPresentation({ slides: data.slides });
            setCurrentSlide(0);
            setFocusedView('pdf');
          },
          onDraw: (data) => drawOnCanvas(data),
          onPointer: (data) => {
            setPointerFraction({ x: data.x / CANVAS_W, y: data.y / CANVAS_H });
            if (pointerTimeoutRef.current) clearTimeout(pointerTimeoutRef.current);
            pointerTimeoutRef.current = setTimeout(() => setPointerFraction(null), 2000);
          },
          onClear: () => {
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              ctx.currentPaths = {};
            }
          },
        });
        clientRef.current = wsClient;
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          setSessionError('Урок не найден. Проверьте ссылку или попросите преподавателя отправить новую.');
        } else {
          setSessionError('Не удалось подключиться к уроку. Проверьте соединение и обновите страницу.');
        }
      }
    };

    load();
    return () => {
      clientRef.current?.disconnect();
      teacherRtcRef.current?.stopStream();
      studentRtcRef.current?.stopStream();
      if (pointerTimeoutRef.current) clearTimeout(pointerTimeoutRef.current);
    };
  }, [sessionId]);

  // ── Load drawings when slide changes OR when returning to the PDF view ──
  // The canvas unmounts when focusedView !== 'pdf', so drawings must be
  // re-fetched every time the canvas mounts again.
  useEffect(() => {
    if (canvasRef.current && sessionId && presentation && focusedView === 'pdf')
      loadSlideDrawings(currentSlide);
  }, [currentSlide, sessionId, presentation, focusedView]);

  const loadSlideDrawings = async (slideIndex) => {
    if (!sessionId || !canvasRef.current) return;
    try {
      const res = await api.get(`/live/sessions/${sessionId}/slides/${slideIndex}/drawings`);
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.currentPaths = {};
      res.data.forEach((path) => {
        if (!path.points?.length) return;
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
        ctx.stroke();
      });
    } catch {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.currentPaths = {};
      }
    }
  };

  // ── Destroy teacher peer (used by force-reconnect and offer-on-stale-peer) ──
  const destroyTeacherPeer = () => {
    teacherRtcRef.current?.stopStream();
    teacherRtcRef.current = null;
    if (teacherVideoRef.current) teacherVideoRef.current.srcObject = null;
    if (sidebarTeacherVideoRef.current) sidebarTeacherVideoRef.current.srcObject = null;
    setTeacherVideoActive(false);
  };

  // ── Create a new receiver peer for teacher's stream ───────────────────
  const createTeacherPeer = () => {
    if (!clientRef.current) return;
    const rtc = new WebRTCService(clientRef.current, sessionId, false, 'teacher', 'student', iceServersRef.current);
    rtc.onRemoteStream = (stream) => {
      teacherStreamRef.current = stream;
      setTeacherMediaConnected(true);
      if (teacherVideoRef.current) teacherVideoRef.current.srcObject = stream;
      if (sidebarTeacherVideoRef.current) sidebarTeacherVideoRef.current.srcObject = stream;

      // Show video as long as there is at least one live video track.
      // Do NOT use onmute — muted fires during renegotiation/ICE restart and would
      // cause a flash-then-black. Only react to permanent track end or unmute
      // (handles the case where tracks arrive in a muted state briefly).
      const checkTeacherVideoActive = () =>
        setTeacherVideoActive(stream.getVideoTracks().some(t => t.readyState === 'live'));

      const attachTrackHandlers = (t) => {
        t.addEventListener('ended', checkTeacherVideoActive);
        t.addEventListener('unmute', checkTeacherVideoActive);
      };

      checkTeacherVideoActive();
      stream.addEventListener('addtrack', (e) => { attachTrackHandlers(e.track); checkTeacherVideoActive(); });
      stream.addEventListener('removetrack', checkTeacherVideoActive);
      stream.getVideoTracks().forEach(attachTrackHandlers);

      // Auto-focus teacher if nothing else is focused
      setFocusedView(prev => prev || 'teacher');
    };
    rtc.connect();
    teacherRtcRef.current = rtc;
  };

  // ── WebRTC: handle incoming signals ──────────────────────────────────
  const handleWebRTCSignal = (data) => {
    // ── force-reconnect: teacher is tearing down its peer (screen share toggle)
    if (data.type === 'force-reconnect' && data.from !== 'student') {
      destroyTeacherPeer();
      return;
    }

    // ── media-state: teacher turned camera/screen on or off explicitly
    if (data.type === 'media-state' && data.from === 'teacher') {
      setTeacherVideoActive(!!data.hasVideo);
      return;
    }

    // ── presence: teacher reconnected (e.g. page refresh) — clean up stale peer,
    // then re-initiate our stream so teacher sees us again.
    if (data.type === 'presence' && data.role === 'teacher') {
      // Destroy the dead peer connection to the old teacher instance.
      // A new one will be created when teacher sends a fresh offer (after they
      // re-enable their camera/mic).
      destroyTeacherPeer();

      const hadAudio = isAudioEnabledRef.current;
      const hadVideo = isVideoEnabledRef.current;
      if (hadAudio || hadVideo) {
        // Tear down old peer (connection to old teacher instance is dead)
        studentRtcRef.current?.stopStream();
        studentRtcRef.current = null;
        const rtc = new WebRTCService(clientRef.current, sessionId, true, 'student', 'student', iceServersRef.current);
        rtc.onRemoteStream = () => {};
        rtc.startStream({ audio: hadAudio, video: hadVideo }).then(ok => {
          if (ok) {
            studentRtcRef.current = rtc;
            // Update local video refs with the new stream (useEffect won't re-run
            // because isVideoEnabled didn't change)
            const stream = rtc.getLocalStream();
            if (localVideoRef.current) { localVideoRef.current.srcObject = stream; localVideoRef.current.play().catch(() => {}); }
            if (sidebarLocalVideoRef.current) { sidebarLocalVideoRef.current.srcObject = stream; sidebarLocalVideoRef.current.play().catch(() => {}); }
          }
        });
      }
      return;
    }

    if (data.type !== 'signal') return;
    if (data.from === 'student') return;

    if (data.role === 'teacher') {
      if (data.signal?.type === 'offer' && teacherRtcRef.current) {
        if (teacherRtcRef.current.isConnected()) {
          // Renegotiation on a live connection (teacher added a track, e.g. camera → audio+video)
          teacherRtcRef.current.handleSignal(data.signal);
          return;
        }
        // Stale / dead peer — destroy and let the fresh peer below handle the offer
        destroyTeacherPeer();
      }
      if (!teacherRtcRef.current) createTeacherPeer();
      teacherRtcRef.current?.handleSignal(data.signal);
    } else if (data.role === 'student') {
      studentRtcRef.current?.handleSignal(data.signal);
    }
  };

  // ── Student mic ───────────────────────────────────────────────────────
  const toggleStudentAudio = async () => {
    if (!isAudioEnabled) {
      if (!clientRef.current) return;
      if (studentRtcRef.current?.hasAudioSender()) {
        const ok = await studentRtcRef.current.enableAudio();
        if (ok) {
          setIsAudioEnabled(true);
        } else {
          toast.error(mediaErrorMessage(studentRtcRef.current, 'микрофону'));
        }
      } else {
        const rtc = new WebRTCService(clientRef.current, sessionId, true, 'student', 'student', iceServersRef.current);
        rtc.onRemoteStream = () => {};
        const ok = await rtc.startStream({ audio: true, video: false });
        if (ok) {
          studentRtcRef.current = rtc;
          setIsAudioEnabled(true);
        } else {
          toast.error(mediaErrorMessage(rtc, 'микрофону'));
        }
      }
    } else {
      if (isVideoEnabled) {
        await studentRtcRef.current.disableAudio();
        setIsAudioEnabled(false);
        setIsMuted(false);
      } else {
        studentRtcRef.current?.stopStream();
        studentRtcRef.current = null;
        if (localVideoRef.current) { localVideoRef.current.srcObject = null; localVideoRef.current.load(); }
        if (sidebarLocalVideoRef.current) { sidebarLocalVideoRef.current.srcObject = null; }
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
        setIsMuted(false);
        setFocusedView(prev => prev === 'local'
          ? (presentationRef.current ? 'pdf' : (teacherStreamRef.current ? 'teacher' : null))
          : prev);
      }
    }
  };

  // ── Student camera ────────────────────────────────────────────────────
  const toggleStudentCamera = async () => {
    if (isVideoEnabled) {
      await studentRtcRef.current.disableCamera();
      clientRef.current?.sendMediaState('student', false);
      if (localVideoRef.current) { localVideoRef.current.srcObject = null; localVideoRef.current.load(); }
      if (sidebarLocalVideoRef.current) { sidebarLocalVideoRef.current.srcObject = null; }
      setIsVideoEnabled(false);
      setFocusedView(prev => prev === 'local'
        ? (presentationRef.current ? 'pdf' : (teacherStreamRef.current ? 'teacher' : null))
        : prev);
      if (!isAudioEnabled) {
        studentRtcRef.current?.stopStream();
        studentRtcRef.current = null;
      }
    } else {
      if (!clientRef.current) return;

      if (studentRtcRef.current?.hasVideoSender()) {
        const ok = await studentRtcRef.current.enableCamera();
        if (ok) {
          setIsVideoEnabled(true);
          clientRef.current?.sendMediaState('student', true);
        } else {
          toast.error(mediaErrorMessage(studentRtcRef.current, 'камере'));
        }
      } else if (studentRtcRef.current) {
        const ok = await studentRtcRef.current.addVideoTrack();
        if (ok) {
          setIsVideoEnabled(true);
          clientRef.current?.sendMediaState('student', true);
        } else {
          toast.error(mediaErrorMessage(studentRtcRef.current, 'камере'));
        }
      } else {
        const rtc = new WebRTCService(clientRef.current, sessionId, true, 'student', 'student', iceServersRef.current);
        rtc.onRemoteStream = () => {};
        const ok = await rtc.startStream({ audio: true, video: true });
        if (ok) {
          studentRtcRef.current = rtc;
          setIsAudioEnabled(true);
          setIsVideoEnabled(true);
          clientRef.current?.sendMediaState('student', true);
        } else {
          toast.error(mediaErrorMessage(rtc, 'камере'));
        }
      }
    }
  };

  const toggleMute = () => {
    if (studentRtcRef.current) {
      const enabled = studentRtcRef.current.toggleMute();
      setIsMuted(!enabled);
    }
  };

  const handleLeaveLesson = () => {
    clientRef.current?.disconnect();
    teacherRtcRef.current?.stopStream();
    studentRtcRef.current?.stopStream();
    navigate('/me');
  };

  // ── Draw (incoming from teacher) ──────────────────────────────────────
  const drawOnCanvas = (data) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (data.end) {
      if (ctx.activePaths) delete ctx.activePaths[data.pathId];
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    if (!data.pathId) return;
    if (!ctx.activePaths) ctx.activePaths = {};

    const isEraser = data.color === 'eraser';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    if (!isEraser) ctx.strokeStyle = data.color;
    ctx.lineWidth = data.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const last = ctx.activePaths[data.pathId];
    if (!last) {
      ctx.activePaths[data.pathId] = { x: data.x, y: data.y };
      ctx.beginPath();
      ctx.arc(data.x, data.y, data.width / 2, 0, Math.PI * 2);
      if (!isEraser) ctx.fillStyle = data.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
      ctx.activePaths[data.pathId] = { x: data.x, y: data.y };
    }
  };

  // ── Helper: apply local stream on video mount ─────────────────────────
  const applyLocalStream = (el) => {
    if (!el || !studentRtcRef.current) return;
    const stream = studentRtcRef.current.getLocalStream();
    if (stream) { el.srcObject = stream; el.play().catch(() => {}); }
  };

  // ── Error state ───────────────────────────────────────────────────────
  if (sessionError) {
    return (
      <div className="live-page" role="main">
        <div className="live-page-header">
          <h1 className="live-page-header-title">Живой урок</h1>
          <button onClick={() => navigate('/')} className="ctrl-btn danger" style={{ marginLeft: 'auto' }}>
            <span className="ctrl-btn-icon">✕</span>
            <span className="ctrl-btn-label">На главную</span>
          </button>
        </div>
        <div className="live-error-state">
          <div style={{ fontSize: 48, opacity: 0.5 }}>⚠️</div>
          <p>{sessionError}</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="live-page student" role="main" aria-label="Живой урок — ученик">

      {/* ── Header ── */}
      <div className="live-page-header">
        <h1 className="live-page-header-title">Живой урок</h1>

        {teacherMediaConnected && (
          <span className="ws-status connected" role="status">
            <span className="ws-dot" />
            Преподаватель подключён
          </span>
        )}

        <button
          onClick={handleLeaveLesson}
          className="ctrl-btn danger"
          style={{ marginLeft: 'auto', flexDirection: 'row', height: 36, padding: '0 14px', gap: 6, minWidth: 'unset' }}
          aria-label="Покинуть урок"
          title="Покинуть урок"
        >
          <span style={{ fontSize: 14 }}>✕</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Покинуть</span>
        </button>
      </div>

      {/* ── Body: main content + sidebar ── */}
      <div className="live-page-body">

        {/* ── Main content ── */}
        <div className="live-main-content">

          {/* PDF / canvas view */}
          {focusedView === 'pdf' && presentation && (
            <div className="main-pdf-wrapper">
              <div className="canvas-container">
                <img
                  src={`${API_BASE}${presentation.slides[currentSlide]}`}
                  alt={`Слайд ${currentSlide + 1}`}
                  className="slide-background"
                  draggable="false"
                />
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className="drawing-canvas"
                  aria-hidden="true"
                  style={{ pointerEvents: 'none' }}
                />

                {pointerFraction && (
                  <div
                    className="pointer-overlay"
                    aria-hidden="true"
                    style={{
                      left: `${pointerFraction.x * 100}%`,
                      top: `${pointerFraction.y * 100}%`,
                    }}
                  >
                    👆
                  </div>
                )}

                <div className="slide-counter" aria-live="polite" aria-atomic="true">
                  {currentSlide + 1} / {presentation.slides.length}
                </div>
              </div>
            </div>
          )}

          {/* Teacher video (main) */}
          {focusedView === 'teacher' && session && (
            <div className="main-video-wrapper">
              {teacherMediaConnected && teacherVideoActive ? (
                <video
                  ref={(el) => {
                    teacherVideoRef.current = el;
                    if (el && teacherStreamRef.current) el.srcObject = teacherStreamRef.current;
                  }}
                  autoPlay
                  playsInline
                  className="main-video-el"
                />
              ) : (
                <div className="main-avatar">
                  <span className="main-avatar-icon">👤</span>
                  <span className="main-avatar-name">Преподаватель</span>
                </div>
              )}
              <div className="main-video-label">Преподаватель</div>
            </div>
          )}

          {/* Own camera (main) */}
          {focusedView === 'local' && isVideoEnabled && (
            <div className="main-video-wrapper">
              <video
                ref={(el) => {
                  localVideoRef.current = el;
                  applyLocalStream(el);
                }}
                autoPlay
                muted
                playsInline
                className="main-video-el"
              />
              <div className="main-video-label">Вы</div>
            </div>
          )}

          {/* Empty / waiting state */}
          {(
            !focusedView ||
            (focusedView === 'pdf' && !presentation) ||
            (focusedView === 'teacher' && !session) ||
            (focusedView === 'local' && !isVideoEnabled)
          ) && (
            <div className="main-empty">
              <div className="main-empty-icon">⏳</div>
              <p>Ожидание презентации от преподавателя...</p>
            </div>
          )}

        </div>

        {/* ── Right sidebar ── */}
        <div className="live-sidebar" aria-label="Участники и контент">

          {/* PDF thumbnail tile */}
          {presentation && (
            <div
              className={`live-sidebar-tile ${focusedView === 'pdf' ? 'active' : ''}`}
              onClick={() => setFocusedView('pdf')}
              title="Показать презентацию"
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setFocusedView('pdf')}
            >
              <img
                src={`${API_BASE}${presentation.slides[currentSlide]}`}
                alt={`Слайд ${currentSlide + 1}`}
                className="tile-img"
              />
              <div className="tile-label">
                Слайд {currentSlide + 1}/{presentation.slides.length}
              </div>
            </div>
          )}

          {/* Teacher tile — always visible once session is loaded */}
          {session && (
            <div
              className={`live-sidebar-tile ${focusedView === 'teacher' ? 'active' : ''}`}
              onClick={() => setFocusedView('teacher')}
              title="Показать видео преподавателя"
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setFocusedView('teacher')}
            >
              {teacherMediaConnected && teacherVideoActive ? (
                <video
                  ref={(el) => {
                    sidebarTeacherVideoRef.current = el;
                    if (el && teacherStreamRef.current) el.srcObject = teacherStreamRef.current;
                  }}
                  autoPlay
                  playsInline
                  className="tile-video"
                />
              ) : (
                <div className="tile-avatar">
                  <span className="tile-avatar-icon">👤</span>
                  <span className="tile-avatar-name">Преподаватель</span>
                </div>
              )}
              <div className="tile-label">Преподаватель</div>
            </div>
          )}

          {/* Own camera tile */}
          {isVideoEnabled && (
            <div
              className={`live-sidebar-tile ${focusedView === 'local' ? 'active' : ''}`}
              onClick={() => setFocusedView('local')}
              title="Показать вашу камеру"
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setFocusedView('local')}
            >
              <video
                ref={(el) => {
                  sidebarLocalVideoRef.current = el;
                  applyLocalStream(el);
                }}
                autoPlay
                muted
                playsInline
                className="tile-video"
              />
              <div className="tile-label">Вы</div>
            </div>
          )}

          {/* Sidebar empty state (presentation section) */}
          {!presentation && (
            <p className="sidebar-no-content">Ожидание презентации...</p>
          )}

        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="live-bottom-bar" role="toolbar" aria-label="Управление медиа">

        {/* Left: empty for student */}
        <div className="bottom-left" />

        {/* Center: media controls */}
        <div className="bottom-center">
          <button
            onClick={toggleStudentAudio}
            className={`ctrl-btn ${isAudioEnabled ? 'active' : ''}`}
            aria-pressed={isAudioEnabled}
            aria-label={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            <span className="ctrl-btn-icon"><IconMic /></span>
            <span className="ctrl-btn-label">Микрофон</span>
          </button>

          <button
            onClick={toggleStudentCamera}
            className={`ctrl-btn ${isVideoEnabled ? 'active' : ''}`}
            aria-pressed={isVideoEnabled}
            aria-label={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
            title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
          >
            <span className="ctrl-btn-icon"><IconCamera /></span>
            <span className="ctrl-btn-label">Камера</span>
          </button>

          {isAudioEnabled && (
            <button
              onClick={toggleMute}
              className={`ctrl-btn ${isMuted ? 'muted' : ''}`}
              aria-pressed={isMuted}
              aria-label={isMuted ? 'Включить звук' : 'Заглушить'}
              title={isMuted ? 'Включить звук' : 'Заглушить'}
            >
              <span className="ctrl-btn-icon">{isMuted ? <IconMuteOff /> : <IconMuteOn />}</span>
              <span className="ctrl-btn-label">{isMuted ? 'Без звука' : 'Звук'}</span>
            </button>
          )}
        </div>

        {/* Right: empty spacer to balance layout */}
        <div className="bottom-right" />

      </div>
    </div>
  );
}

export default LiveLessonStudent;
