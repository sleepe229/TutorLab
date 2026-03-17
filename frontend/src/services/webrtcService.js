import Peer from 'simple-peer';

export class WebRTCService {
  constructor(wsClient, sessionId, isInitiator, role = 'teacher') {
    this.wsClient = wsClient;
    this.sessionId = sessionId;
    this.isInitiator = isInitiator;
    this.role = role; // 'teacher' | 'student'
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
      // Explicitly supply browser RTCPeerConnection to avoid simple-peer
      // using a Node.js wrtc stub when bundled with Vite in production
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
      this.wsClient.sendWebRTC({ type: 'signal', signal: data, role: this.role });
    });

    this.peer.on('stream', (remoteStream) => {
      this.remoteStream = remoteStream;
      this.onRemoteStream?.(remoteStream);
    });

    this.peer.on('error', (err) => {
      console.error('WebRTC peer error:', err);
    });
  }

  // Receive-only (non-initiator without local media)
  connect() {
    if (!this.peer) this._createPeer(null);
  }

  async startStream({ audio = true, video = false } = {}) {
    this.lastError = null;

    // Step 1: get media access
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

    // Step 2: create WebRTC peer (separate from media access)
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

  // Back-compat
  async startAudioStream() {
    return this.startStream({ audio: true, video: false });
  }

  handleSignal(signal) {
    if (!this.peer) this.connect();
    this.peer.signal(signal);
  }

  stopStream() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.peer?.destroy();
    this.localStream = null;
    this.peer = null;
    this.remoteStream = null;
  }

  stopAudioStream() {
    this.stopStream();
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
