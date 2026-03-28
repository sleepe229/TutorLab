// src/components/live/LiveLessonStudent.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectToSession } from '../../services/wsClient';
import { WebRTCService } from '../../services/webrtcService';
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
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pointerFraction, setPointerFraction] = useState(null);

  const teacherRtcRef = useRef(null);
  const studentRtcRef = useRef(null);
  const teacherVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const teacherStreamRef = useRef(null);
  const clientRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerTimeoutRef = useRef(null);

  // ── Assign local stream to video element after it mounts ──────────────
  useEffect(() => {
    if (isVideoEnabled && localVideoRef.current && studentRtcRef.current) {
      localVideoRef.current.srcObject = studentRtcRef.current.getLocalStream();
    }
  }, [isVideoEnabled]);
  // Note: teacher video assignment is handled via ref callback directly on the <video> element

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/live/sessions/${sessionId}`);
        setSession(res.data);

        try {
          const presRes = await api.get(`/live/sessions/${sessionId}/presentation`);
          setPresentation(presRes.data);
          setCurrentSlide(presRes.data.currentSlide || 0);
        } catch {
          // No presentation yet
        }

        const wsClient = connectToSession(sessionId, {
          onWebRTC: handleWebRTCSignal,
          onSlideChange: (data) => setCurrentSlide(data.slideIndex),
          onPresentationUpdate: (data) => {
            setPresentation({ slides: data.slides });
            setCurrentSlide(0);
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

  // ── Load drawings on slide change (also fires when presentation mounts) ─
  useEffect(() => {
    if (canvasRef.current && sessionId && presentation) loadSlideDrawings(currentSlide);
  }, [currentSlide, sessionId, presentation]);

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

  // ── WebRTC: handle incoming signals ──────────────────────────────────
  const handleWebRTCSignal = (data) => {
    if (data.type !== 'signal') return;

    // Ignore own echoes — STOMP broadcasts to all subscribers including sender
    if (data.from === 'student') return;

    if (data.role === 'teacher') {
      // Teacher is initiating their stream toward student
      // If a new offer arrives, destroy the stale receiver peer first
      if (data.signal?.type === 'offer' && teacherRtcRef.current) {
        teacherRtcRef.current.stopStream();
        teacherRtcRef.current = null;
        setTeacherMediaConnected(false);
        if (teacherVideoRef.current) teacherVideoRef.current.srcObject = null;
      }
      if (!teacherRtcRef.current && clientRef.current) {
        // role='teacher' (teacher-initiated connection), sender='student' (I am the student)
        const rtc = new WebRTCService(clientRef.current, sessionId, false, 'teacher', 'student');
        rtc.onRemoteStream = (stream) => {
          teacherStreamRef.current = stream;
          setTeacherMediaConnected(true);
          // Assign directly in case video element is already mounted
          if (teacherVideoRef.current) teacherVideoRef.current.srcObject = stream;
        };
        rtc.connect();
        teacherRtcRef.current = rtc;
      }
      teacherRtcRef.current?.handleSignal(data.signal);
    } else if (data.role === 'student') {
      // Teacher answered student's offer — route to student's own initiator peer
      studentRtcRef.current?.handleSignal(data.signal);
    }
  };

  // ── Student mic ───────────────────────────────────────────────────────
  const toggleStudentAudio = async () => {
    if (!isAudioEnabled) {
      if (!clientRef.current) return;
      // role='student' (student-initiated), sender='student'
      const rtc = new WebRTCService(clientRef.current, sessionId, true, 'student', 'student');
      rtc.onRemoteStream = () => {};
      const ok = await rtc.startStream({ audio: true, video: false });
      if (ok) {
        studentRtcRef.current = rtc;
        setIsAudioEnabled(true);
      } else {
        toast.error(mediaErrorMessage(rtc, 'микрофону'));
      }
    } else {
      studentRtcRef.current?.stopStream();
      studentRtcRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
      setIsMuted(false);
    }
  };

  // ── Student camera ────────────────────────────────────────────────────
  const toggleStudentCamera = async () => {
    if (isVideoEnabled) {
      // Turn off: stop stream, release camera hardware, restart audio-only if mic was on
      const wasMuted = isMuted;
      studentRtcRef.current?.stopStream();
      studentRtcRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setIsVideoEnabled(false);

      if (isAudioEnabled) {
        if (!clientRef.current) { setIsAudioEnabled(false); setIsMuted(false); return; }
        const rtc = new WebRTCService(clientRef.current, sessionId, true, 'student', 'student');
        rtc.onRemoteStream = () => {};
        const ok = await rtc.startStream({ audio: true, video: false });
        if (ok) {
          studentRtcRef.current = rtc;
          // Restore previous mute state: new track starts enabled, re-apply mute if needed
          if (wasMuted) rtc.toggleMute();
        } else {
          setIsAudioEnabled(false);
          setIsMuted(false);
        }
      }
    } else {
      // Turn on: need audio+video stream
      if (!clientRef.current) return;
      // Stop existing audio-only stream if running
      if (studentRtcRef.current) {
        studentRtcRef.current.stopStream();
        studentRtcRef.current = null;
      }
      // role='student' (student-initiated), sender='student'
      const rtc = new WebRTCService(clientRef.current, sessionId, true, 'student', 'student');
      rtc.onRemoteStream = () => {};
      const ok = await rtc.startStream({ audio: true, video: true });
      if (ok) {
        studentRtcRef.current = rtc;
        setIsAudioEnabled(true);
        setIsVideoEnabled(true);
        // srcObject assigned via useEffect once video element mounts
      } else {
        toast.error(mediaErrorMessage(rtc, 'камере'));
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
    navigate('/tutors');
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
      // First point: draw a dot so single-click marks are visible
      ctx.activePaths[data.pathId] = { x: data.x, y: data.y };
      ctx.beginPath();
      ctx.arc(data.x, data.y, data.width / 2, 0, Math.PI * 2);
      if (!isEraser) ctx.fillStyle = data.color;
      ctx.fill();
    } else {
      // Subsequent points: self-contained segment — no shared path state
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
      ctx.activePaths[data.pathId] = { x: data.x, y: data.y };
    }
  };

  // ── Error state ───────────────────────────────────────────────────────
  if (sessionError) {
    return (
      <div className="live-lesson-container" role="main">
        <div className="live-header">
          <div className="live-header-content">
            <h1 className="live-header-title">Живой урок</h1>
            <button onClick={() => navigate('/')} className="end-lesson-button">
              На главную
            </button>
          </div>
        </div>
        <div className="no-presentation" style={{ marginTop: '60px' }}>
          <div className="no-presentation-icon">⚠️</div>
          <p>{sessionError}</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="live-lesson-container" role="main" aria-label="Живой урок — ученик">

      {/* Header — same structure as teacher */}
      <div className="live-header">
        <div className="live-header-content">
          <h1 className="live-header-title">Живой урок</h1>

          {teacherMediaConnected && (
            <span className="ws-status connected" role="status">
              <span className="ws-dot" />
              Преподаватель подключён
            </span>
          )}

          <button onClick={handleLeaveLesson} className="end-lesson-button" aria-label="Покинуть урок">
            Покинуть урок
          </button>
        </div>
      </div>

      {/* Controls — same structure as teacher, media-only */}
      <div className="live-controls" role="toolbar" aria-label="Управление медиа">
        <div className="media-controls">
          <button
            onClick={toggleStudentAudio}
            className={`microphone-button ${isAudioEnabled ? 'active' : ''}`}
            aria-pressed={isAudioEnabled}
            aria-label={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            <IconMic />
            {isAudioEnabled ? 'Микр. вкл' : 'Микрофон'}
          </button>

          <button
            onClick={toggleStudentCamera}
            className={`camera-button ${isVideoEnabled ? 'active' : ''}`}
            aria-pressed={isVideoEnabled}
            aria-label={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
            title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
          >
            <IconCamera />
            {isVideoEnabled ? 'Кам. вкл' : 'Камера'}
          </button>

          {isAudioEnabled && (
            <button
              onClick={toggleMute}
              className={`mute-button ${isMuted ? 'muted' : ''}`}
              aria-pressed={isMuted}
              aria-label={isMuted ? 'Включить звук' : 'Заглушить'}
              title={isMuted ? 'Включить звук' : 'Заглушить'}
            >
              {isMuted ? <IconMuteOff /> : <IconMuteOn />}
            </button>
          )}
        </div>
      </div>

      {/* Video strip — same structure as teacher */}
      {(teacherMediaConnected || isVideoEnabled) && (
        <div className="video-strip">
          {teacherMediaConnected && (
            <div className="video-bubble">
              <video
                ref={(el) => {
                  teacherVideoRef.current = el;
                  if (el && teacherStreamRef.current) el.srcObject = teacherStreamRef.current;
                }}
                autoPlay
                playsInline
                className="video-el"
              />
              <span className="video-bubble-label">Преподаватель</span>
            </div>
          )}
          {isVideoEnabled && (
            <div className="video-bubble">
              <video ref={localVideoRef} autoPlay muted playsInline className="video-el" />
              <span className="video-bubble-label">Вы</span>
            </div>
          )}
        </div>
      )}

      {/* Canvas */}
      {presentation ? (
        <div
          className="canvas-container"
          aria-label={`Слайд ${currentSlide + 1} из ${presentation.slides.length}`}
        >
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
      ) : (
        <div className="no-presentation">
          <div className="no-presentation-icon">⏳</div>
          <p>Ожидание презентации от преподавателя...</p>
        </div>
      )}
    </div>
  );
}

export default LiveLessonStudent;
