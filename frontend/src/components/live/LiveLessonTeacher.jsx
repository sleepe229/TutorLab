// src/components/live/LiveLessonTeacher.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectToSession } from '../../services/wsClient';
import { WebRTCService } from '../../services/webrtcService';
import api, { studentApi, liveApi } from '../../services/api';
import toast from 'react-hot-toast';
import { API_BASE } from '../../config.js';
import {
  IconPen, IconEraser, IconPointer, IconTrash,
  IconUpload, IconMic, IconCamera, IconMuteOff, IconMuteOn, IconLink, IconScreen,
} from './liveIcons.jsx';
import './LiveLesson.css';

function mediaErrorMessage(rtc, type) {
  if (rtc.lastError === 'permission') return `Разрешите доступ к ${type} в настройках браузера`;
  if (rtc.lastError === 'in-use') return `${type === 'камере' ? 'Камера' : 'Микрофон'} используется другим приложением`;
  if (rtc.lastError === 'peer') return 'Ошибка WebRTC. Попробуйте ещё раз';
  return `Нет доступа к ${type}`;
}

function LiveLessonTeacher({ tutorId }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentName = searchParams.get('studentName');

  const [session, setSession] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(3);

  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [studentConnected, setStudentConnected] = useState(false);
  const screenStreamRef = useRef(null);

  // End-lesson modal state
  const [showEndModal, setShowEndModal] = useState(false);
  const [endingLesson, setEndingLesson] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [tutorStudents, setTutorStudents] = useState([]);
  const [snapshotId, setSnapshotId] = useState(null);
  const [recap, setRecap] = useState(null);
  const [recapPolling, setRecapPolling] = useState(false);

  const webrtcRef = useRef(null);
  const studentRtcRef = useRef(null);
  const localVideoRef = useRef(null);
  const studentVideoRef = useRef(null);
  const studentStreamRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const clientRef = useRef(null);
  const isDrawingRef = useRef(false);
  const pathIdRef = useRef(null);
  const lastDrawPointRef = useRef(null);

  // Keep latest values inside event listeners without stale closures
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const lineWidthRef = useRef(lineWidth);
  const presentationRef = useRef(presentation);
  const currentSlideRef = useRef(currentSlide);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);
  useEffect(() => { presentationRef.current = presentation; }, [presentation]);
  useEffect(() => { currentSlideRef.current = currentSlide; }, [currentSlide]);

  // ── Assign local stream to video element after it mounts ──────────────
  useEffect(() => {
    if (localVideoRef.current) {
      if (isScreenSharing && screenStreamRef.current) {
        localVideoRef.current.srcObject = screenStreamRef.current;
      } else if (isVideoEnabled && webrtcRef.current) {
        localVideoRef.current.srcObject = webrtcRef.current.getLocalStream();
      }
    }
  }, [isVideoEnabled, isScreenSharing]);

  // Note: student video assignment is handled via ref callback directly on the <video> element

  // ── Session init (with restore on page refresh) ───────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const savedId = sessionStorage.getItem('liveSessionId');
        let sessionData = null;

        if (savedId) {
          try {
            const res = await api.get(`/live/sessions/${savedId}`);
            if (res.data.tutorId === tutorId) sessionData = res.data;
            else sessionStorage.removeItem('liveSessionId');
          } catch {
            sessionStorage.removeItem('liveSessionId');
          }
        }

        if (!sessionData) {
          const res = await api.post('/live/sessions', null, {
            params: { tutorId, title: 'Урок' },
          });
          sessionData = res.data;
          sessionStorage.setItem('liveSessionId', sessionData.sessionId);
        }

        setSession(sessionData);

        try {
          const presRes = await api.get(`/live/sessions/${sessionData.sessionId}/presentation`);
          setPresentation(presRes.data);
          setCurrentSlide(presRes.data.currentSlide || 0);
        } catch {
          // No presentation yet
        }

        const wsClient = connectToSession(sessionData.sessionId, {
          onConnect: () => setWsConnected(true),
          onWebRTC: handleWebRTCSignal,
          onSlideChange: (data) => setCurrentSlide(data.slideIndex),
          onPresentationUpdate: (data) => {
            setPresentation({ slides: data.slides });
            setCurrentSlide(0);
          },
          onDraw: (data) => drawOnCanvas(data),
          onClear: () => clearCanvas(),
        });
        clientRef.current = wsClient;
      } catch {
        toast.error('Ошибка создания сессии');
      }
    };

    init();
    return () => {
      clientRef.current?.disconnect();
      webrtcRef.current?.stopStream();
      studentRtcRef.current?.stopStream();
    };
  }, [tutorId]);

  // ── Load drawings on slide change (also fires when presentation mounts) ─
  useEffect(() => {
    if (canvasRef.current && session && presentation) loadSlideDrawings(currentSlide);
  }, [currentSlide, session, presentation]);

  const loadSlideDrawings = async (slideIndex) => {
    if (!session || !canvasRef.current) return;
    try {
      const res = await api.get(`/live/sessions/${session.sessionId}/slides/${slideIndex}/drawings`);
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.activePaths = {};
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
        ctx.activePaths = {};
      }
    }
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown':
          e.preventDefault(); handleSlideChangeKbd(1); break;
        case 'ArrowLeft': case 'ArrowUp':
          e.preventDefault(); handleSlideChangeKbd(-1); break;
        case 'p': case 'P': setTool('pen'); break;
        case 'e': case 'E': setTool('eraser'); break;
        case 'Escape': setTool('pointer'); break;
        case 'Delete': case 'Backspace':
          if (e.shiftKey) handleClearDrawings(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSlideChangeKbd = (direction) => {
    const pres = presentationRef.current;
    const cur = currentSlideRef.current;
    if (!pres) return;
    const next = Math.max(0, Math.min(pres.slides.length - 1, cur + direction));
    clientRef.current?.sendSlideChange(next);
  };

  // ── WebRTC ────────────────────────────────────────────────────────────
  const handleWebRTCSignal = (data) => {
    if (data.type !== 'signal') return;

    // Ignore own echoes — STOMP broadcasts to all subscribers including sender
    if (data.from === 'teacher') return;

    if (data.role === 'teacher') {
      // Student answered teacher's offer — route to teacher's own initiator peer
      webrtcRef.current?.handleSignal(data.signal);
    } else if (data.role === 'student') {
      // Student is initiating their own stream toward teacher
      // If we get a new offer, destroy any stale receiver peer first
      if (data.signal?.type === 'offer' && studentRtcRef.current) {
        studentRtcRef.current.stopStream();
        studentRtcRef.current = null;
        setStudentConnected(false);
        if (studentVideoRef.current) studentVideoRef.current.srcObject = null;
      }
      if (!studentRtcRef.current && clientRef.current) {
        // role='student' (student-initiated connection), sender='teacher' (I am the teacher)
        const rtc = new WebRTCService(clientRef.current, null, false, 'student', 'teacher');
        rtc.onRemoteStream = (stream) => {
          studentStreamRef.current = stream;
          setStudentConnected(true);
          // Assign directly in case video element is already mounted
          if (studentVideoRef.current) studentVideoRef.current.srcObject = stream;
        };
        rtc.connect();
        studentRtcRef.current = rtc;
      }
      studentRtcRef.current?.handleSignal(data.signal);
    }
  };

  // ── PDF upload ────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !session) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/live/sessions/${session.sessionId}/presentation`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.status === 202) {
        toast('PDF обрабатывается...');
      } else {
        setPresentation({ slides: res.data.slides });
        setCurrentSlide(0);
      }
    } catch {
      toast.error('Ошибка загрузки PDF');
    } finally {
      setLoading(false);
    }
  };

  // ── Slide navigation ──────────────────────────────────────────────────
  const handleSlideChange = (direction) => {
    if (!presentation) return;
    const next = Math.max(0, Math.min(presentation.slides.length - 1, currentSlide + direction));
    clientRef.current?.sendSlideChange(next);
  };

  // ── Canvas coordinate helper ──────────────────────────────────────────
  const getCanvasCoords = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  // ── Mouse events ──────────────────────────────────────────────────────
  const handleCanvasMouseDown = (e) => {
    if (toolRef.current === 'pointer') return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    isDrawingRef.current = true;
    pathIdRef.current = `path-${Date.now()}-${Math.random()}`;
    lastDrawPointRef.current = { x, y };

    const ctx = canvasRef.current.getContext('2d');
    const isEraser = toolRef.current === 'eraser';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = isEraser ? lineWidthRef.current * 6 : lineWidthRef.current;

    // Draw starting dot so single-click marks are visible
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    if (!isEraser) { ctx.fillStyle = colorRef.current; }
    ctx.fill();

    clientRef.current?.sendDraw({
      pathId: pathIdRef.current, x, y,
      color: isEraser ? 'eraser' : colorRef.current,
      width: ctx.lineWidth,
      end: false,
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!canvasRef.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (toolRef.current === 'pointer') {
      clientRef.current?.sendPointer(x, y);
      return;
    }
    if (!isDrawingRef.current) return;
    const last = lastDrawPointRef.current;
    if (!last) return;

    const ctx = canvasRef.current.getContext('2d');
    const isEraser = toolRef.current === 'eraser';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    if (!isEraser) ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = isEraser ? lineWidthRef.current * 6 : lineWidthRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastDrawPointRef.current = { x, y };

    clientRef.current?.sendDraw({
      pathId: pathIdRef.current, x, y,
      color: isEraser ? 'eraser' : colorRef.current,
      width: ctx.lineWidth,
      end: false,
    });
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastDrawPointRef.current = null;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    clientRef.current?.sendDraw({
      pathId: pathIdRef.current, x: 0, y: 0,
      color: colorRef.current, width: lineWidthRef.current, end: true,
    });
  };

  // ── Touch events ──────────────────────────────────────────────────────
  const handleCanvasTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleCanvasMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
  };
  const handleCanvasTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleCanvasMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  };
  const handleCanvasTouchEnd = (e) => {
    e.preventDefault();
    handleCanvasMouseUp();
  };

  // ── Draw helpers ──────────────────────────────────────────────────────
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

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.activePaths = {};
  };

  const handleClearDrawings = () => {
    clearCanvas();
    clientRef.current?.sendClear();
  };

  // ── Audio ─────────────────────────────────────────────────────────────
  const toggleAudio = async () => {
    if (!isAudioEnabled) {
      if (!clientRef.current) { toast.error('WebSocket не подключён'); return; }
      // role='teacher' (teacher-initiated), sender='teacher'
      const rtc = new WebRTCService(clientRef.current, session.sessionId, true, 'teacher', 'teacher');
      rtc.onRemoteStream = () => {}; // teacher's mic peer — no remote video expected here
      const ok = await rtc.startStream({ audio: true, video: false });
      if (ok) {
        webrtcRef.current = rtc;
        setIsAudioEnabled(true);
      } else {
        toast.error(mediaErrorMessage(rtc, 'микрофону'));
      }
    } else {
      webrtcRef.current?.stopStream();
      webrtcRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (webrtcRef.current) {
      const enabled = webrtcRef.current.toggleMute();
      setIsMuted(!enabled);
    }
  };

  // ── Camera (independent of mic — starts audio+video together) ────────
  const toggleCamera = async () => {
    if (isVideoEnabled) {
      // Stop stream to release camera hardware, restart audio-only if mic was on
      const wasAudioEnabled = isAudioEnabled;
      webrtcRef.current?.stopStream();
      webrtcRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setIsVideoEnabled(false);

      if (wasAudioEnabled) {
        if (!clientRef.current || !session) { setIsAudioEnabled(false); setIsMuted(false); return; }
        const rtc = new WebRTCService(clientRef.current, session.sessionId, true, 'teacher', 'teacher');
        rtc.onRemoteStream = () => {};
        const ok = await rtc.startStream({ audio: true, video: false });
        if (ok) {
          webrtcRef.current = rtc;
        } else {
          setIsAudioEnabled(false);
          setIsMuted(false);
        }
      }
      return;
    }

    if (!clientRef.current) { toast.error('WebSocket не подключён'); return; }
    if (!session) return;

    // Stop existing audio-only stream if running
    if (webrtcRef.current) {
      webrtcRef.current.stopStream();
      webrtcRef.current = null;
      setIsAudioEnabled(false);
      setIsMuted(false);
    }

    // role='teacher' (teacher-initiated), sender='teacher'
    const rtc = new WebRTCService(clientRef.current, session.sessionId, true, 'teacher', 'teacher');
    rtc.onRemoteStream = () => {}; // teacher's camera peer — no remote video expected here
    const ok = await rtc.startStream({ audio: true, video: true });
    if (ok) {
      webrtcRef.current = rtc;
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);
      // srcObject assigned via useEffect once video element mounts
    } else {
      toast.error(mediaErrorMessage(rtc, 'камере'));
    }
  };

  // ── Screen share ──────────────────────────────────────────────────────
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      webrtcRef.current?.stopStream();
      webrtcRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setIsScreenSharing(false);
      setIsAudioEnabled(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;

      // Stop existing mic/camera peer if running
      if (webrtcRef.current) {
        webrtcRef.current.stopStream();
        webrtcRef.current = null;
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
        setIsMuted(false);
      }

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Send screen via WebRTC to student
      if (clientRef.current && session) {
        // role='teacher' (teacher-initiated), sender='teacher'
        const rtc = new WebRTCService(clientRef.current, session.sessionId, true, 'teacher', 'teacher');
        rtc.onRemoteStream = () => {}; // screen share peer — no remote video expected
        const started = rtc.startExistingStream(stream);
        if (!started) {
          toast.error(mediaErrorMessage(rtc, 'экрана'));
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
          }
          if (localVideoRef.current) localVideoRef.current.srcObject = null;
          return;
        }
        webrtcRef.current = rtc;
      }

      setIsScreenSharing(true);

      // Auto-stop when user clicks browser's "Stop sharing" button
      stream.getVideoTracks()[0].onended = () => {
        webrtcRef.current?.stopStream();
        webrtcRef.current = null;
        screenStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setIsScreenSharing(false);
        setIsAudioEnabled(false);
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError') toast.error('Не удалось начать демонстрацию экрана');
    }
  };

  // ── End lesson modal ──────────────────────────────────────────────────
  const handleEndLesson = async () => {
    // Load student list for the dropdown
    try {
      const res = await studentApi.getStudentsByTutor(tutorId);
      setTutorStudents(res.data || []);
    } catch {
      setTutorStudents([]);
    }
    setShowEndModal(true);
  };

  const handleEndLessonConfirm = async () => {
    if (!session || endingLesson) return;
    setEndingLesson(true);

    // Stop media/WS
    sessionStorage.removeItem('liveSessionId');
    clientRef.current?.disconnect();
    webrtcRef.current?.stopStream();
    studentRtcRef.current?.stopStream();
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());

    try {
      const res = await liveApi.endSession(session.sessionId, selectedStudentId || null);
      const sid = res.data.snapshotId;
      setSnapshotId(sid);
      toast.success('Урок завершён. Создаётся конспект...');
      // Poll for recap (max 30s)
      setRecapPolling(true);
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const recapRes = await liveApi.getRecap(sid);
          if (recapRes.data && !recapRes.data.generationFailed) {
            setRecap(recapRes.data);
            clearInterval(poll);
            setRecapPolling(false);
          }
        } catch { /* 404 = not ready yet */ }
        if (attempts >= 10) {
          clearInterval(poll);
          setRecapPolling(false);
        }
      }, 3000);
    } catch (e) {
      toast.error('Ошибка при завершении урока');
      setEndingLesson(false);
    }
  };

  const handleEndLessonDone = () => {
    navigate('/home');
  };

  // ── Copy student link ─────────────────────────────────────────────────
  const handleCopyLink = () => {
    if (session) {
      navigator.clipboard.writeText(`${window.location.origin}/live/student/${session.sessionId}`);
      toast.success('Ссылка скопирована!');
    }
  };

  const getCursor = () => {
    if (tool === 'pointer') return 'default';
    if (tool === 'eraser') return 'cell';
    return 'crosshair';
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="live-lesson-container" role="main" aria-label="Живой урок — преподаватель">

      {/* Header */}
      <div className="live-header">
        <div className="live-header-content">
          <h1 className="live-header-title">
            {studentName ? `Урок — ${studentName}` : 'Живой урок'}
          </h1>

          <span className={`ws-status ${wsConnected ? 'connected' : ''}`} role="status" aria-live="polite">
            <span className="ws-dot" />
            {wsConnected ? 'Подключено' : 'Подключение...'}
          </span>

          {session && (
            <button
              onClick={handleCopyLink}
              className="share-link-btn"
              title="Скопировать ссылку для ученика"
              aria-label="Скопировать ссылку для ученика"
            >
              <IconLink />
              Ссылка
            </button>
          )}

          <button onClick={handleEndLesson} className="end-lesson-button" aria-label="Завершить урок">
            Завершить
          </button>
        </div>
      </div>

      {/* End-lesson modal */}
      {showEndModal && (
        <div className="end-modal-overlay" role="dialog" aria-modal="true" aria-label="Завершение урока">
          <div className="end-modal">
            {!snapshotId ? (
              <>
                <h2 className="end-modal-title">Завершить урок?</h2>
                <p className="end-modal-hint">Выберите ученика, чтобы урок сохранился в его истории.</p>
                <select
                  className="end-modal-select"
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                >
                  <option value="">— Без привязки к ученику —</option>
                  {tutorStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
                <div className="end-modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowEndModal(false)}
                    disabled={endingLesson}
                  >
                    Отмена
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleEndLessonConfirm}
                    disabled={endingLesson}
                  >
                    {endingLesson ? 'Завершение...' : 'Завершить урок'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="end-modal-title">Урок завершён</h2>
                {recapPolling && !recap && (
                  <p className="end-modal-hint">Конспект создаётся, подождите...</p>
                )}
                {recap && !recap.generationFailed && (
                  <div className="end-modal-recap">
                    {recap.topicsCovered?.length > 0 && (
                      <div>
                        <strong>Темы урока:</strong>
                        <ul>{recap.topicsCovered.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                    {recap.struggledWith?.length > 0 && (
                      <div>
                        <strong>Трудности:</strong>
                        <ul>{recap.struggledWith.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                    {recap.homeworkAssigned && (
                      <div><strong>Домашнее задание:</strong> {recap.homeworkAssigned}</div>
                    )}
                    {recap.nextSessionFocus && (
                      <div><strong>На следующий урок:</strong> {recap.nextSessionFocus}</div>
                    )}
                  </div>
                )}
                {!recapPolling && !recap && (
                  <p className="end-modal-hint">Конспект будет готов позже.</p>
                )}
                <div className="end-modal-actions">
                  <button className="btn btn-primary" onClick={handleEndLessonDone}>
                    На главную
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="live-controls" role="toolbar" aria-label="Инструменты урока">
        {presentation && (
          <>
            <div className="slide-controls" role="group" aria-label="Навигация по слайдам">
              <button
                onClick={() => handleSlideChange(-1)}
                disabled={currentSlide === 0}
                aria-label="Предыдущий слайд"
                title="← (стрелка влево)"
              >←</button>
              <span aria-live="polite">{currentSlide + 1} / {presentation.slides.length}</span>
              <button
                onClick={() => handleSlideChange(1)}
                disabled={currentSlide >= presentation.slides.length - 1}
                aria-label="Следующий слайд"
                title="→ (стрелка вправо)"
              >→</button>
            </div>

            <div className="tool-controls" role="group" aria-label="Инструменты рисования">
              <button
                className={tool === 'pen' ? 'active' : ''}
                onClick={() => setTool('pen')}
                aria-pressed={tool === 'pen'}
                title="Ручка (P)"
              >
                <IconPen />
                <span className="kbd-hint">P</span>
              </button>
              <button
                className={tool === 'eraser' ? 'active' : ''}
                onClick={() => setTool('eraser')}
                aria-pressed={tool === 'eraser'}
                title="Ластик (E)"
              >
                <IconEraser />
                <span className="kbd-hint">E</span>
              </button>
              <button
                className={tool === 'pointer' ? 'active' : ''}
                onClick={() => setTool('pointer')}
                aria-pressed={tool === 'pointer'}
                title="Указатель (Esc)"
              >
                <IconPointer />
                <span className="kbd-hint">Esc</span>
              </button>

              {tool !== 'eraser' && tool !== 'pointer' && (
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Цвет линии"
                  title="Цвет"
                  className="color-picker"
                />
              )}

              <label className="line-width-label" title={`Толщина: ${lineWidth}px`}>
                <span className="line-width-value">{lineWidth}</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  aria-label={`Толщина линии: ${lineWidth}`}
                  className="line-width-slider"
                />
              </label>

              <button
                onClick={handleClearDrawings}
                className="clear-button"
                title="Очистить (Shift+Del)"
                aria-label="Очистить рисунки"
              >
                <IconTrash />
                <span className="kbd-hint">⇧Del</span>
              </button>
            </div>
          </>
        )}

        <div className="media-controls">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="pdf-upload"
            disabled={loading}
          />
          <label
            htmlFor="pdf-upload"
            className="pdf-upload-label"
            role="button"
            tabIndex={0}
            title="Загрузить PDF презентацию"
            onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pdf-upload').click()}
          >
            {loading ? '...' : <><IconUpload /> PDF</>}
          </label>

          <button
            onClick={toggleAudio}
            className={`microphone-button ${isAudioEnabled ? 'active' : ''}`}
            aria-pressed={isAudioEnabled}
            aria-label={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            <IconMic />
            {isAudioEnabled ? 'Микр. вкл' : 'Микрофон'}
          </button>

          <button
            onClick={toggleCamera}
            className={`camera-button ${isVideoEnabled ? 'active' : ''}`}
            aria-pressed={isVideoEnabled}
            aria-label={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
            title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру (запустит аудио+видео)'}
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

          <button
            onClick={toggleScreenShare}
            className={`screen-share-button ${isScreenSharing ? 'active' : ''}`}
            aria-pressed={isScreenSharing}
            aria-label={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
            title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
          >
            <IconScreen />
            {isScreenSharing ? 'Стоп' : 'Экран'}
          </button>
        </div>
      </div>

      {/* Video strip */}
      {(isVideoEnabled || isScreenSharing || studentConnected) && (
        <div className="video-strip">
          {(isVideoEnabled || isScreenSharing) && (
            <div className="video-bubble">
              <video ref={localVideoRef} autoPlay muted playsInline className="video-el" />
              <span className="video-bubble-label">{isScreenSharing ? 'Экран' : 'Вы'}</span>
            </div>
          )}
          {studentConnected && (
            <div className="video-bubble">
              <video
                ref={(el) => {
                  studentVideoRef.current = el;
                  if (el && studentStreamRef.current) el.srcObject = studentStreamRef.current;
                }}
                autoPlay
                playsInline
                className="video-el"
              />
              <span className="video-bubble-label">Ученик</span>
            </div>
          )}
        </div>
      )}

      {/* Canvas / empty state */}
      {presentation ? (
        <div className="canvas-container" ref={containerRef}>
          <img
            src={`${API_BASE}${presentation.slides[currentSlide]}`}
            alt={`Слайд ${currentSlide + 1} из ${presentation.slides.length}`}
            className="slide-background"
            draggable="false"
          />
          <canvas
            ref={canvasRef}
            width={1200}
            height={675}
            className="drawing-canvas"
            role="application"
            aria-label={`Холст. Инструмент: ${tool}`}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
            style={{ cursor: getCursor() }}
          />
        </div>
      ) : (
        <div className="no-presentation">
          <div className="no-presentation-icon">📌</div>
          <p>Загрузите PDF презентацию, чтобы начать урок</p>
          <p className="no-presentation-hint">Поддерживаются файлы до 10 МБ</p>
        </div>
      )}
    </div>
  );
}

export default LiveLessonTeacher;
