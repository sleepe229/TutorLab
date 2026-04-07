import Peer from 'simple-peer';
import { API_BASE } from '../config.js';

/**
 * Fetch ICE server configuration from the backend.
 * Falls back to Google STUN only if the request fails.
 * The result should be cached and reused for all peers in a session.
 */
export async function fetchIceServers() {
  try {
    const res = await fetch(`${API_BASE}/api/live/ice-config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.iceServers;
  } catch (err) {
    console.warn('Failed to fetch ICE config, using Google STUN fallback:', err);
    return [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ];
  }
}

/**
 * role   — which connection this belongs to: 'teacher' (teacher-initiated) | 'student' (student-initiated)
 * sender — who is creating this peer:        'teacher' | 'student'
 *
 * Every signal includes both fields so receivers can:
 *   1. Ignore their own echoes (from === own identity)
 *   2. Route to the correct peer (role tells which connection)
 */
export class WebRTCService {
  /**
   * @param {object}   wsClient     — connected STOMP client from wsClient.js
   * @param {string}   sessionId    — used to route signals (may be null for receiver-only peers)
   * @param {boolean}  isInitiator  — true = creates offer
   * @param {string}   role         — 'teacher' | 'student'
   * @param {string}   sender       — identity tag attached to every outgoing signal
   * @param {Array}    iceServers   — ICE config from fetchIceServers(); falls back to STUN
   */
  constructor(wsClient, sessionId, isInitiator, role = 'teacher', sender = null, iceServers = null) {
    this.wsClient    = wsClient;
    this.sessionId   = sessionId;
    this.isInitiator = isInitiator;
    this.role        = role;
    this.sender      = sender ?? role;
    this.peer        = null;
    this.localStream  = null;
    this.remoteStream = null;
    this.onRemoteStream = null;
    this.lastError   = null; // 'permission' | 'in-use' | 'unavailable' | 'peer'

    this._iceServers   = iceServers ?? [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
    this._audioSender  = null; // RTCRtpSender for the audio track, if present
    this._videoSender  = null; // RTCRtpSender for the video track, if present
    // Registered stream/track event listeners — cleaned up in stopStream()
    this._cleanups     = [];
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  _createPeer(stream) {
    const opts = {
      initiator: this.isInitiator,
      trickle: true,
      wrtc: {
        RTCPeerConnection:    window.RTCPeerConnection,
        RTCSessionDescription: window.RTCSessionDescription,
        RTCIceCandidate:      window.RTCIceCandidate,
      },
      config: { iceServers: this._iceServers },
    };
    if (stream) opts.stream = stream;

    this.peer = new Peer(opts);

    this.peer.on('signal', (data) => {
      this.wsClient.sendWebRTC({
        type:   'signal',
        signal: data,
        role:   this.role,
        from:   this.sender,
      });
    });

    this.peer.on('stream', (remoteStream) => {
      this.remoteStream = remoteStream;
      this.onRemoteStream?.(remoteStream);
    });

    this.peer.on('error', (err) => {
      // Suppress expected abort errors produced when we intentionally call peer.destroy()
      if (err?.message?.includes('User-Initiated Abort') || err?.message?.includes('Close called')) return;
      console.error('WebRTC peer error:', err);
    });

    this.peer.on('close', () => {
      console.warn('WebRTC peer closed');
    });
  }

  /** Register a listener and track it for cleanup. */
  _on(target, type, fn) {
    target.addEventListener(type, fn);
    this._cleanups.push({ target, type, fn });
  }

  /** Remove all registered event listeners (call before destroying the stream). */
  _removeAllListeners() {
    this._cleanups.forEach(({ target, type, fn }) => {
      try { target.removeEventListener(type, fn); } catch (_) {}
    });
    this._cleanups = [];
  }

  // ── Public API ────────────────────────────────────────────────────────

  /** Receive-only peer (non-initiator, no local media). */
  connect() {
    if (!this.peer) this._createPeer(null);
  }

  /** Use an already-obtained stream (e.g. getDisplayMedia) without calling getUserMedia. */
  startExistingStream(stream) {
    this.lastError = null;
    this.localStream = stream;
    try {
      this._createPeer(stream);
    } catch (err) {
      console.error('Peer creation failed:', err);
      this.localStream = null;
      this.lastError = 'peer';
      return false;
    }
    // Mirror what startStream() does so audio/video toggling works later.
    if (this.peer?._pc) {
      this._audioSender = this.peer._pc.getSenders().find(s => s.track?.kind === 'audio') ?? null;
      this._videoSender = this.peer._pc.getSenders().find(s => s.track?.kind === 'video') ?? null;
    }
    return true;
  }

  async startStream({ audio = true, video = false } = {}) {
    this.lastError = null;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audio
          ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : false,
        video: video
          ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
          : false,
      });
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.lastError = 'permission';
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        this.lastError = 'in-use';
      } else {
        this.lastError = 'unavailable';
      }
      console.error('getUserMedia failed:', name, err.message);
      return false;
    }

    try {
      this._createPeer(this.localStream);
    } catch (err) {
      console.error('Peer creation failed:', err);
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
      this.lastError = 'peer';
      return false;
    }

    this._audioSender = this.peer._pc.getSenders().find(s => s.track?.kind === 'audio') ?? null;
    if (video) {
      this._videoSender = this.peer._pc.getSenders().find(s => s.track?.kind === 'video') ?? null;
    }

    return true;
  }

  handleSignal(signal) {
    if (!this.peer) this.connect();
    // Peer may have been destroyed between creation and signal arrival (race during reconnect).
    if (this.peer.destroyed) return;
    try {
      this.peer.signal(signal);
    } catch (err) {
      console.error('peer.signal() failed:', err);
    }
  }

  stopStream() {
    this._removeAllListeners();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.peer?.destroy();
    this.localStream  = null;
    this.peer         = null;
    this.remoteStream = null;
    this._audioSender = null;
    this._videoSender = null;
  }

  /**
   * Returns the ICE connection state string, or null if no peer exists.
   * Use this instead of accessing peer._pc directly from component code.
   */
  getIceConnectionState() {
    return this.peer?._pc?.iceConnectionState ?? null;
  }

  /** True once the ICE connection is fully established. */
  isConnected() {
    const state = this.getIceConnectionState();
    if (state === 'connected' || state === 'completed') return true;
    // Fallback for early lifecycle/mocked peers where ICE state is unavailable.
    return !!this.peer?.connected;
  }

  /** True if this peer has an audio sender (enables disableAudio / enableAudio). */
  hasAudioSender() {
    return this._audioSender !== null;
  }

  /** True if this peer has a video sender (enables disableCamera / enableCamera). */
  hasVideoSender() {
    return this._videoSender !== null;
  }

  // ── Audio track management ────────────────────────────────────────────

  /**
   * Stop and release the microphone without touching the peer connection or video.
   * replaceTrack(null) is awaited first so the sender doesn't reference a stopped track.
   */
  async disableAudio() {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return;
    try {
      await this._audioSender?.replaceTrack(null);
    } catch (err) {
      console.error('replaceTrack(null) audio failed:', err);
    }
    track.stop();
    this.localStream?.removeTrack(track);
  }

  /**
   * Acquire a new microphone track and inject it into the existing peer via replaceTrack.
   * No renegotiation needed — video continues uninterrupted.
   */
  async enableAudio() {
    this.lastError = null;
    if (!this._audioSender) return false;

    let track;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      track = stream.getAudioTracks()[0];
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.lastError = 'permission';
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        this.lastError = 'in-use';
      } else {
        this.lastError = 'unavailable';
      }
      return false;
    }

    try {
      await this._audioSender.replaceTrack(track);
    } catch (err) {
      console.error('replaceTrack audio failed:', err);
      track.stop();
      this.lastError = 'peer';
      return false;
    }

    this.localStream?.addTrack(track);
    return true;
  }

  // ── Video / camera track management ──────────────────────────────────

  /**
   * Add a microphone track to an existing peer (e.g. a screen-share peer that has no audio).
   * Uses pc.addTrack() so simple-peer picks up onnegotiationneeded and renegotiates.
   * No need to destroy/recreate the peer — the video/screen stream stays alive.
   */
  async addAudioTrack() {
    this.lastError = null;
    if (!this.peer || !this.localStream) return false;

    let track;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      track = stream.getAudioTracks()[0];
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') this.lastError = 'permission';
      else if (name === 'NotReadableError' || name === 'AbortError') this.lastError = 'in-use';
      else this.lastError = 'unavailable';
      return false;
    }

    this.localStream.addTrack(track);
    this.peer._pc.addTrack(track, this.localStream);
    this._audioSender = this.peer._pc.getSenders().find(s => s.track === track) ?? null;
    return true;
  }

  /**
   * Add a video track to an existing audio-only peer via pc.addTrack().
   * simple-peer picks up onnegotiationneeded and renegotiates — audio stays alive.
   */
  async addVideoTrack() {
    this.lastError = null;
    if (!this.peer || !this.localStream) return false;

    let track;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      track = stream.getVideoTracks()[0];
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.lastError = 'permission';
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        this.lastError = 'in-use';
      } else {
        this.lastError = 'unavailable';
      }
      return false;
    }

    this.localStream.addTrack(track);
    this.peer._pc.addTrack(track, this.localStream);
    this._videoSender = this.peer._pc.getSenders().find(s => s.track === track) ?? null;
    return true;
  }

  /**
   * Stop and release the camera without touching the peer connection or audio.
   */
  async disableCamera() {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await this._videoSender?.replaceTrack(null);
    } catch (err) {
      console.error('replaceTrack(null) camera failed:', err);
    }
    track.stop();
    this.localStream?.removeTrack(track);
  }

  /**
   * Acquire a new camera track and inject it into the existing peer via replaceTrack.
   * No renegotiation needed — audio continues uninterrupted.
   */
  async enableCamera() {
    this.lastError = null;
    if (!this._videoSender) return false;

    let track;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      track = stream.getVideoTracks()[0];
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.lastError = 'permission';
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        this.lastError = 'in-use';
      } else {
        this.lastError = 'unavailable';
      }
      return false;
    }

    try {
      await this._videoSender.replaceTrack(track);
    } catch (err) {
      console.error('replaceTrack camera failed:', err);
      track.stop();
      this.lastError = 'peer';
      return false;
    }

    this.localStream?.addTrack(track);
    return true;
  }

  // ── Mic mute (local only, no signalling) ─────────────────────────────

  toggleMute() {
    const t = this.localStream?.getAudioTracks()[0];
    if (!t) return false;
    t.enabled = !t.enabled;
    return t.enabled;
  }

  getLocalStream() {
    return this.localStream;
  }
}
