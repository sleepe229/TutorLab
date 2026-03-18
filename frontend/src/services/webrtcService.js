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
    this.sender = sender ?? role; // who I am; defaults to role for initiators
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.onRemoteStream = null;
    this.lastError = null; // 'permission' | 'in-use' | 'unavailable' | 'peer'
  }

  _createPeer(stream) {
    const opts = {
      initiator: this.isInitiator,
      trickle: false,
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
        role: this.role,   // which connection: 'teacher' | 'student'
        from: this.sender, // who sent this: 'teacher' | 'student'
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
  }

  toggleMute() {
    const t = this.localStream?.getAudioTracks()[0];
    if (!t) return false;
    t.enabled = !t.enabled;
    return t.enabled;
  }

  toggleVideo() {
    const t = this.localStream?.getVideoTracks()[0];
    if (!t) return false;
    t.enabled = !t.enabled;
    return t.enabled;
  }

  getLocalStream() {
    return this.localStream;
  }
}
