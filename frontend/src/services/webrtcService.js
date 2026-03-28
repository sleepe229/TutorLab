import Peer from 'simple-peer';

/**
 * role   — which connection this belongs to: 'teacher' (teacher-initiated) | 'student' (student-initiated)
 * sender — who is creating this peer:        'teacher' | 'student'
 *
 * Every signal includes both fields so receivers can:
 *   1. Ignore their own echoes (from === own identity)
 *   2. Route to the correct peer (role tells which connection)
 */
export class WebRTCService {
  constructor(wsClient, sessionId, isInitiator, role = 'teacher', sender = null) {
    this.wsClient = wsClient;
    this.sessionId = sessionId;
    this.isInitiator = isInitiator;
    this.role = role;
    this.sender = sender ?? role;
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.onRemoteStream = null;
    this.lastError = null; // 'permission' | 'in-use' | 'unavailable' | 'peer'
    this._videoSender = null; // RTCRtpSender for the video track, if present
  }

  _createPeer(stream) {
    const opts = {
      initiator: this.isInitiator,
      trickle: true,
      wrtc: {
        RTCPeerConnection: window.RTCPeerConnection,
        RTCSessionDescription: window.RTCSessionDescription,
        RTCIceCandidate: window.RTCIceCandidate,
      },
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    };
    if (stream) opts.stream = stream;

    this.peer = new Peer(opts);

    this.peer.on('signal', (data) => {
      this.wsClient.sendWebRTC({
        type: 'signal',
        signal: data,
        role: this.role,
        from: this.sender,
      });
    });

    this.peer.on('stream', (remoteStream) => {
      this.remoteStream = remoteStream;
      this.onRemoteStream?.(remoteStream);
    });

    this.peer.on('error', (err) => {
      console.error('WebRTC peer error:', err);
    });

    this.peer.on('close', () => {
      console.warn('WebRTC peer closed');
    });
  }

  // Receive-only (non-initiator without local media)
  connect() {
    if (!this.peer) this._createPeer(null);
  }

  // Use an already-obtained stream (e.g. getDisplayMedia) without calling getUserMedia
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

    if (video) {
      this._videoSender = this.peer._pc.getSenders().find(s => s.track?.kind === 'video') ?? null;
    }

    return true;
  }

  handleSignal(signal) {
    if (!this.peer) this.connect();
    try {
      this.peer.signal(signal);
    } catch (err) {
      console.error('peer.signal() failed:', err);
    }
  }

  stopStream() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.peer?.destroy();
    this.localStream = null;
    this.peer = null;
    this.remoteStream = null;
    this._videoSender = null;
  }

  // True once the ICE connection is established
  isConnected() {
    return this.peer?.connected ?? false;
  }

  // True if this peer was started with a video track (enables disableCamera / enableCamera)
  hasVideoSender() {
    return this._videoSender !== null;
  }

  // Add a video track to an existing audio-only peer via pc.addTrack().
  // simple-peer detects onnegotiationneeded and renegotiates automatically —
  // audio is never interrupted.
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

  // Stop and release camera hardware without touching the peer connection or audio.
  // Uses replaceTrack(null) so the remote sees the video stop before the track is freed.
  disableCamera() {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return;
    this._videoSender?.replaceTrack(null);
    track.stop();
    this.localStream?.removeTrack(track);
  }

  // Acquire a new camera track and inject it into the existing peer via replaceTrack.
  // No renegotiation — audio continues uninterrupted.
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

    await this._videoSender.replaceTrack(track);
    this.localStream?.addTrack(track);
    return true;
  }

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
