// src/components/live/LiveLessonTeacher.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectToSession } from '../../services/wsClient';
import { WebRTCService, fetchIceServers } from '../../services/webrtcService';
import api, { studentApi, liveApi } from '../../services/api';
import toast from 'react-hot-toast';
import { API_BASE } from '../../config.js';
import {
  IconPen, IconEraser, IconPointer, IconTrash,
  IconUpload, IconMic, IconCamera, IconLink, IconScreen,
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
  const preselectedStudentId = searchParams.get('studentId') || '';

  const [session, setSession] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(3);

  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [studentConnected, setStudentConnected] = useState(false);
  // true once any WebRTC signal from student arrives (student is "in the call")
  const [studentPresent, setStudentPresent] = useState(false);
  // true while student's video track is active (not muted/null)
  const [studentVideoActive, setStudentVideoActive] = useState(false);

  // 'pdf' | 'local' | 'student' | null
  const [focusedView, setFocusedView] = useState(null);

  const screenStreamRef = useRef(null);

  // End-lesson modal state
  const [showEndModal, setShowEndModal] = useState(false);
  const [endingLesson, setEndingLesson] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(preselectedStudentId);
  const [tutorStudents, setTutorStudents] = useState([]);
  const [snapshotId, setSnapshotId] = useState(null);
  const [recap, setRecap] = useState(null);
  const [recapPolling, setRecapPolling] = useState(false);

  const webrtcRef = useRef(null);
  const studentRtcRef = useRef(null);
  // Main-area video refs
  const localVideoRef = useRef(null);
  const studentVideoRef = useRef(null);
  // Sidebar tile video refs
  const sidebarLocalVideoRef = useRef(null);
  const sidebarStudentVideoRef = useRef(null);

  const studentStreamRef = useRef(null);
  const canvasRef = useRef(null);
  // ICE servers fetched once per session and reused for all peers
  const iceServersRef = useRef(null);
  // Session ID stored in a ref so it's accessible inside stale WS callbacks
  const sessionIdRef = useRef(null);
  // Saved media state from sessionStorage — used for auto-restore after page refresh
  const mediaRestoreRef = useRef(null);
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
  const isAudioEnabledRef = useRef(isAudioEnabled);
  const isVideoEnabledRef = useRef(isVideoEnabled);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);
  useEffect(() => { presentationRef.current = presentation; }, [presentation]);
  useEffect(() => { currentSlideRef.current = currentSlide; }, [currentSlide]);
  useEffect(() => { isAudioEnabledRef.current = isAudioEnabled; }, [isAudioEnabled]);
  useEffect(() => { isVideoEnabledRef.current = isVideoEnabled; }, [isVideoEnabled]);

  // ── Sync local stream to both main and sidebar video elements ────────
  useEffect(() => {
    const stream = isScreenSharing
      ? screenStreamRef.current
      : (isVideoEnabled && webrtcRef.current ? webrtcRef.current.getLocalStream() : null);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      if (stream) localVideoRef.current.play().catch(() => {});
    }
    if (sidebarLocalVideoRef.current) {
      sidebarLocalVideoRef.current.srcObject = stream;
      if (stream) sidebarLocalVideoRef.current.play().catch(() => {});
    }
  }, [isVideoEnabled, isScreenSharing, focusedView]);

  // ── Persist media state so it survives page refresh ──────────────────
  useEffect(() => {
    sessionStorage.setItem('liveMediaState', JSON.stringify({
      wasAudio: isAudioEnabled,
      wasVideo: isVideoEnabled,
    }));
  }, [isAudioEnabled, isVideoEnabled]);

  // ── Auto-restore camera/mic after page refresh ────────────────────────
  // Fires once when both WS and session are ready and there is a saved state.
  useEffect(() => {
    if (!wsConnected || !session || !mediaRestoreRef.current) return;
    const state = mediaRestoreRef.current;
    mediaRestoreRef.current = null; // only restore once

    // Small delay: let presence reach the student and let their peer initialise
    // before our offer arrives, to avoid the offer being dropped.
    const t = setTimeout(async () => {
      if (!clientRef.current || !iceServersRef.current) return;
      const rtc = new WebRTCService(
        clientRef.current, session.sessionId, true, 'teacher', 'teacher', iceServersRef.current
      );
      rtc.onRemoteStream = () => {};
      const ok = await rtc.startStream({ audio: state.wasAudio, video: state.wasVideo });
      if (ok) {
        webrtcRef.current = rtc;
        setIsAudioEnabled(state.wasAudio);
        setIsVideoEnabled(state.wasVideo);
        if (state.wasVideo) {
          clientRef.current?.sendMediaState('teacher', true);
          setFocusedView(prev => prev || 'local');
        }
        toast(state.wasVideo ? 'Камера и микрофон восстановлены' : 'Микрофон восстановлен',
          { icon: state.wasVideo ? '📷' : '🎤', duration: 3000 });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [wsConnected, session]);

  // ── Session init (with restore on page refresh) ───────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch ICE servers once; reused for every WebRTC peer in this session
        iceServersRef.current = await fetchIceServers();

        const savedId = sessionStorage.getItem('liveSessionId');
        let sessionData = null;
        let isRestoredSession = false;

        if (savedId) {
          try {
            const res = await api.get(`/live/sessions/${savedId}`);
            if (res.data.tutorId === tutorId) {
              sessionData = res.data;
              isRestoredSession = true;
            } else {
              sessionStorage.removeItem('liveSessionId');
            }
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

        // Queue media restore only when coming back to an existing session
        if (isRestoredSession) {
          try {
            const saved = JSON.parse(sessionStorage.getItem('liveMediaState') || 'null');
            if (saved?.wasAudio || saved?.wasVideo) mediaRestoreRef.current = saved;
          } catch { /* ignore malformed data */ }
        }

        sessionIdRef.current = sessionData.sessionId;
        setSession(sessionData);

        try {
          const presRes = await api.get(`/live/sessions/${sessionData.sessionId}/presentation`);
          setPresentation(presRes.data);
          setCurrentSlide(presRes.data.currentSlide || 0);
          setFocusedView('pdf');
        } catch {
          // No presentation yet
        }

        const wsClient = connectToSession(sessionData.sessionId, {
          onConnect: () => {
            setWsConnected(true);
            // Notify student that teacher is (re)connected so they can re-initiate their stream.
            // Small delay lets both sides finish subscribing before the signal travels.
            setTimeout(() => wsClient.sendPresence('teacher'), 300);
          },
          onWebRTC: handleWebRTCSignal,
          onSlideChange: (data) => setCurrentSlide(data.slideIndex),
          onPresentationUpdate: (data) => {
            setPresentation({ slides: data.slides });
            setCurrentSlide(0);
            setFocusedView('pdf');
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

  // ── Load drawings on slide change ─────────────────────────────────────
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
    // Ignore own echoes
    if (data.from === 'teacher') return;

    // Presence: student (re)connected — clean up stale peers, then mark as present.
    // Also recreate teacher's outgoing stream peer so the student receives a fresh
    // offer (the old initiator peer was connected to the previous student instance
    // and will never be answered again after the student reloaded the page).
    if (data.type === 'presence' && data.role === 'student') {
      // Clean up stale student→teacher receiving peer
      if (studentRtcRef.current) {
        studentRtcRef.current.stopStream();
        studentRtcRef.current = null;
      }
      studentStreamRef.current = null;
      if (studentVideoRef.current) studentVideoRef.current.srcObject = null;
      if (sidebarStudentVideoRef.current) sidebarStudentVideoRef.current.srcObject = null;
      setStudentConnected(false);
      setStudentVideoActive(false);
      setStudentPresent(true);

      // If teacher has an active media stream, recreate the outgoing peer so the
      // newly reconnected student receives a fresh offer.
      const hadAudio = isAudioEnabledRef.current;
      const hadVideo = isVideoEnabledRef.current;
      if ((hadAudio || hadVideo) && webrtcRef.current && clientRef.current && sessionIdRef.current) {
        // Tell student's old dead receiver peer to clean itself up
        clientRef.current.sendForceReconnect('teacher');

        webrtcRef.current.stopStream();
        webrtcRef.current = null;

        // Small delay so the student processes force-reconnect and creates a fresh
        // non-initiator peer before our new offer arrives.
        setTimeout(async () => {
          if (!clientRef.current || !iceServersRef.current) return;
          const rtc = new WebRTCService(
            clientRef.current, sessionIdRef.current, true, 'teacher', 'teacher', iceServersRef.current
          );
          rtc.onRemoteStream = () => {};
          const ok = await rtc.startStream({ audio: hadAudio, video: hadVideo });
          if (ok) {
            webrtcRef.current = rtc;
            if (hadVideo) clientRef.current?.sendMediaState('teacher', true);
          }
        }, 400);
      }
      return;
    }

    // Media-state: student turned camera on/off
    if (data.type === 'media-state' && data.from === 'student') {
      setStudentVideoActive(!!data.hasVideo);
      return;
    }

    if (data.type !== 'signal') return;

    if (data.role === 'teacher') {
      // Student answered teacher's offer — route to teacher's own initiator peer
      webrtcRef.current?.handleSignal(data.signal);
    } else if (data.role === 'student') {
      // Student is sending their stream toward teacher
      if (data.signal?.type === 'offer' && studentRtcRef.current) {
        if (studentRtcRef.current.isConnected()) {
          studentRtcRef.current.handleSignal(data.signal);
          return;
        }
        studentRtcRef.current.stopStream();
        studentRtcRef.current = null;
        setStudentConnected(false);
        if (studentVideoRef.current) studentVideoRef.current.srcObject = null;
        if (sidebarStudentVideoRef.current) sidebarStudentVideoRef.current.srcObject = null;
      }
      setStudentPresent(true);
      if (!studentRtcRef.current && clientRef.current) {
        const rtc = new WebRTCService(clientRef.current, null, false, 'student', 'teacher', iceServersRef.current);
        rtc.onRemoteStream = (stream) => {
          studentStreamRef.current = stream;
          setStudentConnected(true);
          if (studentVideoRef.current) studentVideoRef.current.srcObject = stream;
          if (sidebarStudentVideoRef.current) sidebarStudentVideoRef.current.srcObject = stream;

          // Show video tile as long as there is at least one video track.
          // Do NOT use onmute — tracks temporarily go muted during renegotiation/ICE restart,
          // which would cause a flash-then-black. Only hide on permanent track end.
          const checkVideoActive = () =>
            setStudentVideoActive(stream.getVideoTracks().some(t => t.readyState === 'live'));

          const attachTrackHandlers = (t) => {
            t.addEventListener('ended', checkVideoActive);
            t.addEventListener('unmute', checkVideoActive);
          };

          checkVideoActive();
          stream.addEventListener('addtrack', (e) => { attachTrackHandlers(e.track); checkVideoActive(); });
          stream.addEventListener('removetrack', checkVideoActive);
          stream.getVideoTracks().forEach(attachTrackHandlers);

          setFocusedView(prev => prev || 'student');
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
        setFocusedView('pdf');
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
      if (webrtcRef.current?.hasAudioSender()) {
        // Existing peer already has an audio sender — just un-mute the track
        const ok = await webrtcRef.current.enableAudio();
        if (ok) {
          setIsAudioEnabled(true);
        } else {
          toast.error(mediaErrorMessage(webrtcRef.current, 'микрофону'));
        }
      } else if (isScreenSharing && webrtcRef.current) {
        // Screen-share peer has no audio sender yet — add audio via renegotiation.
        // Do NOT create a new peer: that would destroy the screen-share stream.
        const ok = await webrtcRef.current.addAudioTrack();
        if (ok) {
          setIsAudioEnabled(true);
        } else {
          toast.error(mediaErrorMessage(webrtcRef.current, 'микрофону'));
        }
      } else {
        // No peer yet — create an audio-only initiator peer
        const rtc = new WebRTCService(clientRef.current, session.sessionId, true, 'teacher', 'teacher', iceServersRef.current);
        rtc.onRemoteStream = () => {};
        const ok = await rtc.startStream({ audio: true, video: false });
        if (ok) {
          webrtcRef.current = rtc;
          setIsAudioEnabled(true);
        } else {
          toast.error(mediaErrorMessage(rtc, 'микрофону'));
        }
      }
    } else {
      if (isVideoEnabled || isScreenSharing) {
        if (webrtcRef.current) await webrtcRef.current.disableAudio();
        setIsAudioEnabled(false);
      } else {
        webrtcRef.current?.stopStream();
        webrtcRef.current = null;
        if (localVideoRef.current) { localVideoRef.current.srcObject = null; localVideoRef.current.load(); }
        if (sidebarLocalVideoRef.current) { sidebarLocalVideoRef.current.srcObject = null; }
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
        setFocusedView(prev => prev === 'local' ? (presentationRef.current ? 'pdf' : null) : prev);
      }
    }
  };

  // ── Camera ────────────────────────────────────────────────────────────
  const toggleCamera = async () => {
    if (isVideoEnabled) {
      if (!webrtcRef.current) { setIsVideoEnabled(false); return; }
      await webrtcRef.current.disableCamera();
      // Notify student that teacher's video is gone
      clientRef.current?.sendMediaState('teacher', false);
      if (localVideoRef.current) { localVideoRef.current.srcObject = null; localVideoRef.current.load(); }
      if (sidebarLocalVideoRef.current) { sidebarLocalVideoRef.current.srcObject = null; }
      setIsVideoEnabled(false);
      setFocusedView(prev => prev === 'local' ? (presentationRef.current ? 'pdf' : null) : prev);
      if (!isAudioEnabled) {
        webrtcRef.current?.stopStream();
        webrtcRef.current = null;
      }
      return;
    }

    if (!clientRef.current) { toast.error('WebSocket не подключён'); return; }
    if (!session) return;

    // Turning on camera while screen-sharing: stop screen share first so we can
    // create a fresh camera peer without conflicting with the screen-share peer.
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      clientRef.current?.sendForceReconnect('teacher');
      clientRef.current?.sendMediaState('teacher', false);
      webrtcRef.current?.stopStream();
      webrtcRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (sidebarLocalVideoRef.current) sidebarLocalVideoRef.current.srcObject = null;
      setIsScreenSharing(false);
      setIsAudioEnabled(false);
      setFocusedView(prev => prev === 'local' ? (presentationRef.current ? 'pdf' : null) : prev);
      // Fall through — webrtcRef.current is now null, camera start proceeds below
    }

    if (webrtcRef.current?.hasVideoSender()) {
      const ok = await webrtcRef.current.enableCamera();
      if (ok) {
        setIsVideoEnabled(true);
        clientRef.current?.sendMediaState('teacher', true);
      } else {
        toast.error(mediaErrorMessage(webrtcRef.current, 'камере'));
      }
      return;
    }

    if (webrtcRef.current) {
      // Existing audio-only peer — add video track via renegotiation
      const ok = await webrtcRef.current.addVideoTrack();
      if (ok) {
        setIsVideoEnabled(true);
        clientRef.current?.sendMediaState('teacher', true);
      } else {
        toast.error(mediaErrorMessage(webrtcRef.current, 'камере'));
      }
      return;
    }

    const rtc = new WebRTCService(clientRef.current, session.sessionId, true, 'teacher', 'teacher', iceServersRef.current);
    rtc.onRemoteStream = () => {};
    const ok = await rtc.startStream({ audio: false, video: true });
    if (ok) {
      webrtcRef.current = rtc;
      setIsVideoEnabled(true);
      clientRef.current?.sendMediaState('teacher', true);
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
      // Tell student to discard the current peer before we destroy ours
      clientRef.current?.sendForceReconnect('teacher');
      clientRef.current?.sendMediaState('teacher', false);
      webrtcRef.current?.stopStream();
      webrtcRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (sidebarLocalVideoRef.current) sidebarLocalVideoRef.current.srcObject = null;
      setIsScreenSharing(false);
      setIsAudioEnabled(false);
      setFocusedView(prev => prev === 'local' ? (presentationRef.current ? 'pdf' : null) : prev);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;

      if (webrtcRef.current) {
        // Tell student to discard the current peer before we destroy ours
        clientRef.current?.sendForceReconnect('teacher');
        webrtcRef.current.stopStream();
        webrtcRef.current = null;
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
      }

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      if (sidebarLocalVideoRef.current) sidebarLocalVideoRef.current.srcObject = stream;

      if (clientRef.current && session) {
        const rtc = new WebRTCService(clientRef.current, session.sessionId, true, 'teacher', 'teacher', iceServersRef.current);
        rtc.onRemoteStream = () => {};
        const started = rtc.startExistingStream(stream);
        if (!started) {
          toast.error(mediaErrorMessage(rtc, 'экрана'));
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
          }
          if (localVideoRef.current) localVideoRef.current.srcObject = null;
          if (sidebarLocalVideoRef.current) sidebarLocalVideoRef.current.srcObject = null;
          return;
        }
        webrtcRef.current = rtc;
      }

      setIsScreenSharing(true);
      setFocusedView('local');
      clientRef.current?.sendMediaState('teacher', true);

      stream.getVideoTracks()[0].onended = () => {
        clientRef.current?.sendForceReconnect('teacher');
        clientRef.current?.sendMediaState('teacher', false);
        webrtcRef.current?.stopStream();
        webrtcRef.current = null;
        screenStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (sidebarLocalVideoRef.current) sidebarLocalVideoRef.current.srcObject = null;
        setIsScreenSharing(false);
        setIsAudioEnabled(false);
        setFocusedView(prev => prev === 'local' ? (presentationRef.current ? 'pdf' : null) : prev);
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError') toast.error('Не удалось начать демонстрацию экрана');
    }
  };

  // ── End lesson modal ──────────────────────────────────────────────────
  const handleEndLesson = async () => {
    if (!preselectedStudentId) {
      try {
        const res = await studentApi.getStudentsByTutor(tutorId);
        setTutorStudents(res.data || []);
      } catch {
        setTutorStudents([]);
      }
    }
    setShowEndModal(true);
  };

  const handleEndLessonConfirm = async () => {
    if (!session || endingLesson) return;
    setEndingLesson(true);

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
    } catch {
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

  // ── Helper: apply local stream to a video element on mount ───────────
  const applyLocalStream = (el) => {
    if (!el) return;
    const stream = isScreenSharing
      ? screenStreamRef.current
      : (webrtcRef.current ? webrtcRef.current.getLocalStream() : null);
    if (stream) { el.srcObject = stream; el.play().catch(() => {}); }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="live-page" role="main" aria-label="Живой урок — преподаватель">

      {/* ── Header ── */}
      <div className="live-page-header">
        <h1 className="live-page-header-title">
          {studentName ? `Урок — ${studentName}` : 'Живой урок'}
        </h1>

        <span className={`ws-status ${wsConnected ? 'connected' : ''}`} role="status" aria-live="polite">
          <span className="ws-dot" />
          {wsConnected ? 'Подключено' : 'Подключение...'}
        </span>

        <button
          onClick={handleEndLesson}
          className="end-lesson-header-btn"
          aria-label="Завершить урок"
          title="Завершить урок"
        >
          ✕ Завершить
        </button>
      </div>

      {/* ── End-lesson modal ── */}
      {showEndModal && (
        <div className="end-modal-overlay" role="dialog" aria-modal="true" aria-label="Завершение урока">
          <div className="end-modal">
            {!snapshotId ? (
              <>
                <h2 className="end-modal-title">Завершить урок?</h2>
                {preselectedStudentId ? (
                  <p className="end-modal-hint">
                    Урок будет сохранён в истории ученика <strong>{studentName || 'ученика'}</strong>.
                  </p>
                ) : (
                  <>
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
                  </>
                )}
                <div className="end-modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowEndModal(false)} disabled={endingLesson}>
                    Отмена
                  </button>
                  <button className="btn btn-danger" onClick={handleEndLessonConfirm} disabled={endingLesson}>
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

      {/* ── Body: main content + sidebar ── */}
      <div className="live-page-body">

        {/* ── Main content ── */}
        <div className="live-main-content">

          {/* PDF / canvas view */}
          {focusedView === 'pdf' && presentation && (
            <div className="main-pdf-wrapper">
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
            </div>
          )}

          {/* Local video / screen share (main) */}
          {focusedView === 'local' && (isVideoEnabled || isScreenSharing) && (
            <div className="main-video-wrapper">
              <video
                ref={(el) => {
                  localVideoRef.current = el;
                  applyLocalStream(el);
                }}
                autoPlay
                muted
                playsInline
                className={`main-video-el${isVideoEnabled && !isScreenSharing ? ' video-mirrored' : ''}`}
              />
              <div className="main-video-label">
                {isScreenSharing ? 'Ваш экран' : 'Вы'}
              </div>
            </div>
          )}

          {/* Student video (main) */}
          {focusedView === 'student' && studentPresent && (
            <div className="main-video-wrapper">
              {studentConnected && studentVideoActive ? (
                <video
                  ref={(el) => {
                    studentVideoRef.current = el;
                    if (el && studentStreamRef.current) el.srcObject = studentStreamRef.current;
                  }}
                  autoPlay
                  playsInline
                  className="main-video-el"
                />
              ) : (
                <div className="main-avatar">
                  <span className="main-avatar-icon">👤</span>
                  <span className="main-avatar-name">{studentName || 'Ученик'}</span>
                </div>
              )}
              <div className="main-video-label">Ученик</div>
            </div>
          )}

          {/* Empty / fallback state */}
          {(
            !focusedView ||
            (focusedView === 'pdf' && !presentation) ||
            (focusedView === 'local' && !isVideoEnabled && !isScreenSharing) ||
            (focusedView === 'student' && !studentPresent)
          ) && (
            <div className="main-empty">
              <div className="main-empty-icon">📌</div>
              <p>Загрузите PDF презентацию, чтобы начать урок</p>
              <p className="main-empty-hint">Поддерживаются файлы до 10 МБ</p>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFocusedView('pdf');
                }
              }}
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

          {/* Local video / screen share tile */}
          {(isVideoEnabled || isScreenSharing) && (
            <div
              className={`live-sidebar-tile ${focusedView === 'local' ? 'active' : ''}`}
              onClick={() => setFocusedView('local')}
              title={isScreenSharing ? 'Показать ваш экран' : 'Показать вашу камеру'}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFocusedView('local');
                }
              }}
            >
              <video
                ref={(el) => {
                  sidebarLocalVideoRef.current = el;
                  applyLocalStream(el);
                }}
                autoPlay
                muted
                playsInline
                className={`tile-video${isVideoEnabled && !isScreenSharing ? ' video-mirrored' : ''}`}
              />
              <div className="tile-label">{isScreenSharing ? 'Экран' : 'Вы'}</div>
            </div>
          )}

          {/* Student tile — always visible once student is in the call */}
          {studentPresent && (
            <div
              className={`live-sidebar-tile ${focusedView === 'student' ? 'active' : ''}`}
              onClick={() => setFocusedView('student')}
              title="Показать видео ученика"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFocusedView('student');
                }
              }}
            >
              {studentConnected && studentVideoActive ? (
                <video
                  ref={(el) => {
                    sidebarStudentVideoRef.current = el;
                    if (el && studentStreamRef.current) el.srcObject = studentStreamRef.current;
                  }}
                  autoPlay
                  playsInline
                  className="tile-video"
                />
              ) : (
                <div className="tile-avatar">
                  <span className="tile-avatar-icon">👤</span>
                  <span className="tile-avatar-name">{studentName || 'Ученик'}</span>
                </div>
              )}
              <div className="tile-label">Ученик</div>
            </div>
          )}

          {/* Sidebar empty state */}
          {!presentation && !isVideoEnabled && !isScreenSharing && !studentPresent && (
            <p className="sidebar-no-content">Участники появятся здесь</p>
          )}

        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="live-bottom-bar" role="toolbar" aria-label="Управление уроком">

        {/* Left: slide nav + drawing tools (PDF mode only) */}
        <div className="bottom-left">
          {focusedView === 'pdf' && presentation && (
            <>
              <div className="bottom-slide-nav" role="group" aria-label="Слайды">
                <button
                  className="nav-btn"
                  onClick={() => handleSlideChange(-1)}
                  disabled={currentSlide === 0}
                  aria-label="Предыдущий слайд"
                  title="← (стрелка влево)"
                >←</button>
                <span className="slide-nav-counter" aria-live="polite">
                  {currentSlide + 1} / {presentation.slides.length}
                </span>
                <button
                  className="nav-btn"
                  onClick={() => handleSlideChange(1)}
                  disabled={currentSlide >= presentation.slides.length - 1}
                  aria-label="Следующий слайд"
                  title="→ (стрелка вправо)"
                >→</button>
              </div>

              <div className="bottom-draw-group" role="group" aria-label="Инструменты рисования">
                <button
                  className={`draw-tool-btn ${tool === 'pen' ? 'active' : ''}`}
                  onClick={() => setTool('pen')}
                  aria-pressed={tool === 'pen'}
                  title="Ручка (P)"
                ><IconPen /></button>

                <button
                  className={`draw-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                  onClick={() => setTool('eraser')}
                  aria-pressed={tool === 'eraser'}
                  title="Ластик (E)"
                ><IconEraser /></button>

                <button
                  className={`draw-tool-btn ${tool === 'pointer' ? 'active' : ''}`}
                  onClick={() => setTool('pointer')}
                  aria-pressed={tool === 'pointer'}
                  title="Указатель (Esc)"
                ><IconPointer /></button>

                {tool !== 'eraser' && tool !== 'pointer' && (
                  <>
                    <div className="draw-group-sep" />
                    <input
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="draw-color-picker"
                      aria-label="Цвет линии"
                      title="Цвет"
                    />
                  </>
                )}

                <div className="draw-group-sep" />
                <div className="draw-width-group">
                  <span className="draw-width-value">{lineWidth}</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={lineWidth}
                    onChange={e => setLineWidth(Number(e.target.value))}
                    className="draw-width-slider"
                    aria-label={`Толщина линии: ${lineWidth}`}
                    title={`Толщина: ${lineWidth}px`}
                  />
                </div>

                <div className="draw-group-sep" />
                <button
                  className="draw-tool-btn clear-btn"
                  onClick={handleClearDrawings}
                  title="Очистить (Shift+Del)"
                  aria-label="Очистить рисунки"
                ><IconTrash /></button>
              </div>
            </>
          )}
        </div>

        {/* Center: media controls */}
        <div className="bottom-center">
          <button
            onClick={toggleAudio}
            className={`ctrl-btn ${isAudioEnabled ? 'active' : ''}`}
            aria-pressed={isAudioEnabled}
            aria-label={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          >
            <span className="ctrl-btn-icon"><IconMic /></span>
            <span className="ctrl-btn-label">Микрофон</span>
          </button>

          <button
            onClick={toggleCamera}
            className={`ctrl-btn ${isVideoEnabled ? 'active' : ''}`}
            aria-pressed={isVideoEnabled}
            aria-label={isScreenSharing ? 'Переключиться с экрана на камеру' : (isVideoEnabled ? 'Выключить камеру' : 'Включить камеру')}
            title={isScreenSharing ? 'Переключиться с демонстрации экрана на камеру' : (isVideoEnabled ? 'Выключить камеру' : 'Включить камеру')}
          >
            <span className="ctrl-btn-icon"><IconCamera /></span>
            <span className="ctrl-btn-label">Камера</span>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`ctrl-btn ${isScreenSharing ? 'screen-on' : ''}`}
            aria-pressed={isScreenSharing}
            disabled={isVideoEnabled}
            aria-label={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
            title={isVideoEnabled ? 'Недоступно при включённой камере' : (isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана')}
          >
            <span className="ctrl-btn-icon"><IconScreen /></span>
            <span className="ctrl-btn-label">{isScreenSharing ? 'Стоп' : 'Экран'}</span>
          </button>

          <div className="bottom-center-sep" />

          <label
            htmlFor="pdf-upload"
            className="ctrl-btn"
            role="button"
            tabIndex={0}
            title="Загрузить PDF презентацию"
            onKeyDown={e => e.key === 'Enter' && document.getElementById('pdf-upload').click()}
          >
            <span className="ctrl-btn-icon"><IconUpload /></span>
            <span className="ctrl-btn-label">{loading ? '...' : 'PDF'}</span>
          </label>
        </div>

        {/* Right: copy link */}
        <div className="bottom-right">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="pdf-upload"
            disabled={loading}
          />

          {session && (
            <button
              onClick={handleCopyLink}
              className="ctrl-btn"
              aria-label="Скопировать ссылку для ученика"
              title="Скопировать ссылку для ученика"
            >
              <span className="ctrl-btn-icon"><IconLink /></span>
              <span className="ctrl-btn-label">Ссылка</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default LiveLessonTeacher;
