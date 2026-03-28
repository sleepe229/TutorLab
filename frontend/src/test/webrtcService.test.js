import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Media helpers ─────────────────────────────────────────────────────────────

const makeTrack = (kind = 'audio') => ({
  kind,
  enabled: true,
  stop: vi.fn(),
});

const makeStream = ({ audio = true, video = false } = {}) => {
  const audioTracks = audio ? [makeTrack('audio')] : [];
  const videoTracks = video ? [makeTrack('video')] : [];
  return {
    getAudioTracks: vi.fn(() => audioTracks),
    getVideoTracks: vi.fn(() => videoTracks),
    getTracks:      vi.fn(() => [...audioTracks, ...videoTracks]),
    addTrack:       vi.fn(),
    removeTrack:    vi.fn(),
  };
};

// ── simple-peer mock ──────────────────────────────────────────────────────────
// Simulates Peer construction, signal routing, and RTCPeerConnection senders.

const peerMocks = vi.hoisted(() => {
  let _last = null;

  const makeSender = (track) => ({
    track,
    replaceTrack: vi.fn().mockResolvedValue(undefined),
  });

  const makePc = () => {
    const senders = [];
    return {
      senders,
      getSenders: vi.fn(() => senders),
      addTrack: vi.fn((track) => {
        const sender = makeSender(track);
        senders.push(sender);
        return sender;
      }),
    };
  };

  class MockPeer {
    constructor(opts) {
      this.opts     = opts;
      this.connected = false;
      this._handlers = {};
      this._pc = makePc();

      // Mimic simple-peer: each stream track gets a sender on _pc
      (opts.stream?.getTracks?.() ?? []).forEach(track => {
        this._pc.senders.push(makeSender(track));
      });

      this.on      = vi.fn((ev, cb) => { this._handlers[ev] = cb; });
      this.signal  = vi.fn();
      this.destroy = vi.fn();
      _last = this;
    }
  }

  return {
    MockPeer,
    getLastPeer:   () => _last,
    resetLastPeer: () => { _last = null; },
    makeSender,
  };
});

vi.mock('simple-peer', () => ({ default: peerMocks.MockPeer }));

// ── Subject under test ────────────────────────────────────────────────────────

import { WebRTCService } from '../services/webrtcService.js';

// ── Shared setup ──────────────────────────────────────────────────────────────

let getUserMedia;
let wsClient;

beforeEach(() => {
  vi.clearAllMocks();
  peerMocks.resetLastPeer();

  getUserMedia = vi.fn();
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
    writable: true,
  });

  wsClient = { sendWebRTC: vi.fn() };
});

// ── Helper: boot an audio+video service ──────────────────────────────────────

async function startWithVideo() {
  const stream = makeStream({ audio: true, video: true });
  getUserMedia.mockResolvedValue(stream);
  const svc = new WebRTCService(wsClient, 'sess-1', true, 'teacher', 'teacher');
  await svc.startStream({ audio: true, video: true });
  return { svc, stream, peer: peerMocks.getLastPeer() };
}

async function startAudioOnly() {
  const stream = makeStream({ audio: true, video: false });
  getUserMedia.mockResolvedValue(stream);
  const svc = new WebRTCService(wsClient, 'sess-1', true, 'student', 'student');
  await svc.startStream({ audio: true, video: false });
  return { svc, stream, peer: peerMocks.getLastPeer() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor
// ─────────────────────────────────────────────────────────────────────────────

describe('constructor', () => {
  it('initialises all fields to null / defaults', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true, 'teacher', 'teacher');
    expect(svc.peer).toBeNull();
    expect(svc.localStream).toBeNull();
    expect(svc.remoteStream).toBeNull();
    expect(svc.lastError).toBeNull();
    expect(svc._videoSender).toBeNull();
    expect(svc.role).toBe('teacher');
    expect(svc.sender).toBe('teacher');
    expect(svc.isInitiator).toBe(true);
  });

  it('sender defaults to role when omitted', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true, 'student');
    expect(svc.sender).toBe('student');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// connect()
// ─────────────────────────────────────────────────────────────────────────────

describe('connect()', () => {
  it('creates a peer with no stream attached', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', false, 'teacher', 'student');
    svc.connect();
    expect(peerMocks.getLastPeer()).not.toBeNull();
    expect(peerMocks.getLastPeer().opts.stream).toBeUndefined();
  });

  it('is idempotent — second call reuses the existing peer', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', false);
    svc.connect();
    const first = svc.peer;
    svc.connect();
    expect(svc.peer).toBe(first);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startExistingStream()
// ─────────────────────────────────────────────────────────────────────────────

describe('startExistingStream()', () => {
  it('stores the stream and creates a peer', () => {
    const stream = makeStream();
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    const ok = svc.startExistingStream(stream);
    expect(ok).toBe(true);
    expect(svc.localStream).toBe(stream);
    expect(svc.peer).not.toBeNull();
  });

  it('returns false and sets lastError="peer" when _createPeer throws', () => {
    const stream = makeStream();
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    svc._createPeer = () => { throw new Error('boom'); };
    const ok = svc.startExistingStream(stream);
    expect(ok).toBe(false);
    expect(svc.lastError).toBe('peer');
    expect(svc.localStream).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startStream()
// ─────────────────────────────────────────────────────────────────────────────

describe('startStream()', () => {
  it('creates an audio-only peer and leaves _videoSender null', async () => {
    const stream = makeStream({ audio: true, video: false });
    getUserMedia.mockResolvedValue(stream);
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    const ok = await svc.startStream({ audio: true, video: false });
    expect(ok).toBe(true);
    expect(svc.localStream).toBe(stream);
    expect(svc._videoSender).toBeNull();
  });

  it('creates an audio+video peer and stores _videoSender', async () => {
    const { svc } = await startWithVideo();
    expect(svc._videoSender).not.toBeNull();
    expect(svc._videoSender.track.kind).toBe('video');
  });

  it('passes trickle:true to Peer', async () => {
    const stream = makeStream();
    getUserMedia.mockResolvedValue(stream);
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    await svc.startStream();
    expect(peerMocks.getLastPeer().opts.trickle).toBe(true);
  });

  it.each([
    ['NotAllowedError',      'permission'],
    ['PermissionDeniedError','permission'],
    ['NotReadableError',     'in-use'],
    ['AbortError',           'in-use'],
    ['SomeRandomError',      'unavailable'],
  ])('getUserMedia %s → lastError="%s"', async (errName, expected) => {
    const err = Object.assign(new Error(), { name: errName });
    getUserMedia.mockRejectedValue(err);
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    const ok = await svc.startStream();
    expect(ok).toBe(false);
    expect(svc.lastError).toBe(expected);
  });

  it('stops all tracks and sets lastError="peer" when _createPeer throws', async () => {
    const audioTrack = makeTrack('audio');
    const stream = makeStream({ audio: true });
    stream.getTracks = vi.fn(() => [audioTrack]);
    getUserMedia.mockResolvedValue(stream);
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    svc._createPeer = () => { throw new Error('peer exploded'); };
    const ok = await svc.startStream({ audio: true });
    expect(ok).toBe(false);
    expect(svc.lastError).toBe('peer');
    expect(svc.localStream).toBeNull();
    expect(audioTrack.stop).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Signal routing (_createPeer event wiring)
// ─────────────────────────────────────────────────────────────────────────────

describe('_createPeer — event wiring', () => {
  it("peer 'signal' event forwards payload to wsClient.sendWebRTC", async () => {
    const { peer } = await startAudioOnly();
    const signalData = { type: 'offer', sdp: 'v=0...' };
    peer._handlers['signal'](signalData);
    expect(wsClient.sendWebRTC).toHaveBeenCalledWith({
      type: 'signal',
      signal: signalData,
      role: 'student',
      from: 'student',
    });
  });

  it("peer 'stream' event stores remoteStream and calls onRemoteStream", async () => {
    const { svc, peer } = await startAudioOnly();
    const onRemoteStream = vi.fn();
    svc.onRemoteStream = onRemoteStream;
    const remoteStream = makeStream();
    peer._handlers['stream'](remoteStream);
    expect(svc.remoteStream).toBe(remoteStream);
    expect(onRemoteStream).toHaveBeenCalledWith(remoteStream);
  });

  it("peer 'stream' event is safe when onRemoteStream is not set", async () => {
    const { peer } = await startAudioOnly();
    expect(() => peer._handlers['stream'](makeStream())).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSignal()
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSignal()', () => {
  it('calls peer.signal() with the provided data', async () => {
    const { svc, peer } = await startAudioOnly();
    const sig = { type: 'answer', sdp: '...' };
    svc.handleSignal(sig);
    expect(peer.signal).toHaveBeenCalledWith(sig);
  });

  it('creates a receive-only peer first if none exists', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', false);
    svc.handleSignal({ type: 'offer', sdp: '...' });
    expect(svc.peer).not.toBeNull();
    expect(peerMocks.getLastPeer().signal).toHaveBeenCalled();
  });

  it('swallows errors from peer.signal() without throwing', async () => {
    const { svc, peer } = await startAudioOnly();
    peer.signal.mockImplementation(() => { throw new Error('signal failed'); });
    expect(() => svc.handleSignal({ type: 'candidate' })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stopStream()
// ─────────────────────────────────────────────────────────────────────────────

describe('stopStream()', () => {
  it('stops every track on localStream', async () => {
    const audioTrack = makeTrack('audio');
    const videoTrack = makeTrack('video');
    const stream = makeStream({ audio: true, video: true });
    stream.getTracks = vi.fn(() => [audioTrack, videoTrack]);
    getUserMedia.mockResolvedValue(stream);
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    await svc.startStream({ audio: true, video: true });
    svc.stopStream();
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(videoTrack.stop).toHaveBeenCalled();
  });

  it('destroys the peer', async () => {
    const { svc, peer } = await startAudioOnly();
    svc.stopStream();
    expect(peer.destroy).toHaveBeenCalled();
  });

  it('resets all fields to null', async () => {
    const { svc } = await startWithVideo();
    svc.stopStream();
    expect(svc.peer).toBeNull();
    expect(svc.localStream).toBeNull();
    expect(svc.remoteStream).toBeNull();
    expect(svc._videoSender).toBeNull();
  });

  it('is safe to call when already stopped', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    expect(() => svc.stopStream()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isConnected() / hasVideoSender()
// ─────────────────────────────────────────────────────────────────────────────

describe('isConnected()', () => {
  it('returns false when there is no peer', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    expect(svc.isConnected()).toBe(false);
  });

  it('reflects peer.connected', async () => {
    const { svc, peer } = await startAudioOnly();
    expect(svc.isConnected()).toBe(false);
    peer.connected = true;
    expect(svc.isConnected()).toBe(true);
  });
});

describe('hasVideoSender()', () => {
  it('returns false before any stream is started', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    expect(svc.hasVideoSender()).toBe(false);
  });

  it('returns false after audio-only startStream', async () => {
    const { svc } = await startAudioOnly();
    expect(svc.hasVideoSender()).toBe(false);
  });

  it('returns true after audio+video startStream', async () => {
    const { svc } = await startWithVideo();
    expect(svc.hasVideoSender()).toBe(true);
  });

  it('returns false after stopStream', async () => {
    const { svc } = await startWithVideo();
    svc.stopStream();
    expect(svc.hasVideoSender()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addVideoTrack()
// ─────────────────────────────────────────────────────────────────────────────

describe('addVideoTrack()', () => {
  it('returns false when peer does not exist', async () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    expect(await svc.addVideoTrack()).toBe(false);
  });

  it('returns false when localStream does not exist', async () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    svc.peer = peerMocks.getLastPeer() ?? {}; // non-null peer
    svc.localStream = null;
    expect(await svc.addVideoTrack()).toBe(false);
  });

  it.each([
    ['NotAllowedError',      'permission'],
    ['PermissionDeniedError','permission'],
    ['NotReadableError',     'in-use'],
    ['AbortError',           'in-use'],
    ['DevicesNotFoundError', 'unavailable'],
  ])('getUserMedia %s → lastError="%s", returns false', async (errName, expected) => {
    const { svc } = await startAudioOnly();
    const err = Object.assign(new Error(), { name: errName });
    getUserMedia.mockRejectedValue(err);
    const ok = await svc.addVideoTrack();
    expect(ok).toBe(false);
    expect(svc.lastError).toBe(expected);
  });

  it('adds track to localStream, registers sender on _pc, stores _videoSender', async () => {
    const { svc, stream, peer } = await startAudioOnly();
    const videoTrack = makeTrack('video');
    const videoStream = { getVideoTracks: () => [videoTrack] };
    getUserMedia.mockResolvedValue(videoStream);

    const ok = await svc.addVideoTrack();

    expect(ok).toBe(true);
    expect(stream.addTrack).toHaveBeenCalledWith(videoTrack);
    expect(peer._pc.addTrack).toHaveBeenCalledWith(videoTrack, stream);
    expect(svc._videoSender).not.toBeNull();
    expect(svc._videoSender.track).toBe(videoTrack);
  });

  it('sets hasVideoSender() to true after success', async () => {
    const { svc } = await startAudioOnly();
    const videoTrack = makeTrack('video');
    getUserMedia.mockResolvedValue({ getVideoTracks: () => [videoTrack] });
    await svc.addVideoTrack();
    expect(svc.hasVideoSender()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// disableCamera()
// ─────────────────────────────────────────────────────────────────────────────

describe('disableCamera()', () => {
  it('is a no-op when there is no video track', async () => {
    const { svc } = await startAudioOnly();
    await expect(svc.disableCamera()).resolves.not.toThrow();
  });

  it('calls replaceTrack(null), stops the track, and removes it from stream', async () => {
    const { svc, stream } = await startWithVideo();
    const videoTrack = stream.getVideoTracks()[0];

    await svc.disableCamera();

    expect(svc._videoSender.replaceTrack).toHaveBeenCalledWith(null);
    expect(videoTrack.stop).toHaveBeenCalled();
    expect(stream.removeTrack).toHaveBeenCalledWith(videoTrack);
  });

  it('replaceTrack(null) is awaited before track.stop()', async () => {
    const { svc, stream } = await startWithVideo();
    const videoTrack = stream.getVideoTracks()[0];

    let replaceResolved = false;
    let stopCalledBeforeResolve = false;

    svc._videoSender.replaceTrack.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => { replaceResolved = true; resolve(); }, 10))
    );
    videoTrack.stop.mockImplementation(() => {
      stopCalledBeforeResolve = !replaceResolved;
    });

    await svc.disableCamera();

    expect(stopCalledBeforeResolve).toBe(false);
    expect(videoTrack.stop).toHaveBeenCalled();
  });

  it('still stops the track even if replaceTrack(null) rejects', async () => {
    const { svc, stream } = await startWithVideo();
    const videoTrack = stream.getVideoTracks()[0];
    svc._videoSender.replaceTrack.mockRejectedValue(new Error('sender closed'));

    await svc.disableCamera();

    expect(videoTrack.stop).toHaveBeenCalled();
    expect(stream.removeTrack).toHaveBeenCalledWith(videoTrack);
  });

  it('preserves _videoSender so enableCamera() can reuse it', async () => {
    const { svc } = await startWithVideo();
    const senderBefore = svc._videoSender;
    await svc.disableCamera();
    expect(svc._videoSender).toBe(senderBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enableCamera()
// ─────────────────────────────────────────────────────────────────────────────

describe('enableCamera()', () => {
  it('returns false immediately when _videoSender is null', async () => {
    const { svc } = await startAudioOnly();
    expect(await svc.enableCamera()).toBe(false);
  });

  it.each([
    ['NotAllowedError',      'permission'],
    ['PermissionDeniedError','permission'],
    ['NotReadableError',     'in-use'],
    ['AbortError',           'in-use'],
    ['UnknownError',         'unavailable'],
  ])('getUserMedia %s → lastError="%s", returns false', async (errName, expected) => {
    const { svc } = await startWithVideo();
    await svc.disableCamera();
    const err = Object.assign(new Error(), { name: errName });
    getUserMedia.mockRejectedValue(err);
    const ok = await svc.enableCamera();
    expect(ok).toBe(false);
    expect(svc.lastError).toBe(expected);
  });

  it('stops the new track and sets lastError="peer" when replaceTrack rejects', async () => {
    const { svc } = await startWithVideo();
    await svc.disableCamera();

    const newTrack = makeTrack('video');
    getUserMedia.mockResolvedValue({ getVideoTracks: () => [newTrack] });
    svc._videoSender.replaceTrack.mockRejectedValue(new Error('ICE failed'));

    const ok = await svc.enableCamera();

    expect(ok).toBe(false);
    expect(newTrack.stop).toHaveBeenCalled();
    expect(svc.lastError).toBe('peer');
  });

  it('does not leak the new track to localStream on replaceTrack failure', async () => {
    const { svc, stream } = await startWithVideo();
    await svc.disableCamera();

    getUserMedia.mockResolvedValue({ getVideoTracks: () => [makeTrack('video')] });
    svc._videoSender.replaceTrack.mockRejectedValue(new Error('fail'));

    await svc.enableCamera();

    expect(stream.addTrack).not.toHaveBeenCalled();
  });

  it('calls replaceTrack with the new track and adds it to localStream', async () => {
    const { svc, stream } = await startWithVideo();
    await svc.disableCamera();

    const newTrack = makeTrack('video');
    getUserMedia.mockResolvedValue({ getVideoTracks: () => [newTrack] });

    const ok = await svc.enableCamera();

    expect(ok).toBe(true);
    expect(svc._videoSender.replaceTrack).toHaveBeenCalledWith(newTrack);
    expect(stream.addTrack).toHaveBeenCalledWith(newTrack);
  });

  it('getUserMedia is called with correct video constraints', async () => {
    const { svc } = await startWithVideo();
    await svc.disableCamera();
    getUserMedia.mockResolvedValue({ getVideoTracks: () => [makeTrack('video')] });

    await svc.enableCamera();

    expect(getUserMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hasAudioSender() / disableAudio() / enableAudio()
// ─────────────────────────────────────────────────────────────────────────────

describe('hasAudioSender()', () => {
  it('returns false before any stream is started', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    expect(svc.hasAudioSender()).toBe(false);
  });

  it('returns true after startStream with audio', async () => {
    const { svc } = await startAudioOnly();
    expect(svc.hasAudioSender()).toBe(true);
  });

  it('returns true after startStream with audio+video', async () => {
    const { svc } = await startWithVideo();
    expect(svc.hasAudioSender()).toBe(true);
  });

  it('returns false after stopStream', async () => {
    const { svc } = await startAudioOnly();
    svc.stopStream();
    expect(svc.hasAudioSender()).toBe(false);
  });
});

describe('disableAudio()', () => {
  it('is a no-op when there is no audio track', async () => {
    const stream = makeStream({ audio: false, video: true });
    getUserMedia.mockResolvedValue(stream);
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    await svc.startStream({ audio: false, video: true });
    await expect(svc.disableAudio()).resolves.not.toThrow();
  });

  it('calls replaceTrack(null), stops the track, and removes it from stream', async () => {
    const { svc, stream } = await startAudioOnly();
    const audioTrack = stream.getAudioTracks()[0];

    await svc.disableAudio();

    expect(svc._audioSender.replaceTrack).toHaveBeenCalledWith(null);
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(stream.removeTrack).toHaveBeenCalledWith(audioTrack);
  });

  it('still stops the track even if replaceTrack(null) rejects', async () => {
    const { svc, stream } = await startAudioOnly();
    const audioTrack = stream.getAudioTracks()[0];
    svc._audioSender.replaceTrack.mockRejectedValue(new Error('sender closed'));

    await svc.disableAudio();

    expect(audioTrack.stop).toHaveBeenCalled();
    expect(stream.removeTrack).toHaveBeenCalledWith(audioTrack);
  });

  it('preserves _audioSender so enableAudio() can reuse it', async () => {
    const { svc } = await startAudioOnly();
    const senderBefore = svc._audioSender;
    await svc.disableAudio();
    expect(svc._audioSender).toBe(senderBefore);
  });
});

describe('enableAudio()', () => {
  it('returns false immediately when _audioSender is null', async () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    expect(await svc.enableAudio()).toBe(false);
  });

  it.each([
    ['NotAllowedError',      'permission'],
    ['PermissionDeniedError','permission'],
    ['NotReadableError',     'in-use'],
    ['AbortError',           'in-use'],
    ['UnknownError',         'unavailable'],
  ])('getUserMedia %s → lastError="%s", returns false', async (errName, expected) => {
    const { svc } = await startAudioOnly();
    await svc.disableAudio();
    const err = Object.assign(new Error(), { name: errName });
    getUserMedia.mockRejectedValue(err);
    const ok = await svc.enableAudio();
    expect(ok).toBe(false);
    expect(svc.lastError).toBe(expected);
  });

  it('stops the new track and sets lastError="peer" when replaceTrack rejects', async () => {
    const { svc } = await startAudioOnly();
    await svc.disableAudio();

    const newTrack = makeTrack('audio');
    getUserMedia.mockResolvedValue({ getAudioTracks: () => [newTrack] });
    svc._audioSender.replaceTrack.mockRejectedValue(new Error('ICE failed'));

    const ok = await svc.enableAudio();

    expect(ok).toBe(false);
    expect(newTrack.stop).toHaveBeenCalled();
    expect(svc.lastError).toBe('peer');
  });

  it('does not leak the new track to localStream on replaceTrack failure', async () => {
    const { svc, stream } = await startAudioOnly();
    await svc.disableAudio();

    getUserMedia.mockResolvedValue({ getAudioTracks: () => [makeTrack('audio')] });
    svc._audioSender.replaceTrack.mockRejectedValue(new Error('fail'));

    await svc.enableAudio();

    expect(stream.addTrack).not.toHaveBeenCalled();
  });

  it('calls replaceTrack with the new track and adds it to localStream', async () => {
    const { svc, stream } = await startAudioOnly();
    await svc.disableAudio();

    const newTrack = makeTrack('audio');
    getUserMedia.mockResolvedValue({ getAudioTracks: () => [newTrack] });

    const ok = await svc.enableAudio();

    expect(ok).toBe(true);
    expect(svc._audioSender.replaceTrack).toHaveBeenCalledWith(newTrack);
    expect(stream.addTrack).toHaveBeenCalledWith(newTrack);
  });

  it('getUserMedia is called with correct audio constraints', async () => {
    const { svc } = await startAudioOnly();
    await svc.disableAudio();
    getUserMedia.mockResolvedValue({ getAudioTracks: () => [makeTrack('audio')] });

    await svc.enableAudio();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleMute()
// ─────────────────────────────────────────────────────────────────────────────

describe('toggleMute()', () => {
  it('returns false when there is no localStream', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    expect(svc.toggleMute()).toBe(false);
  });

  it('returns false when there are no audio tracks', async () => {
    const stream = makeStream({ audio: false, video: true });
    getUserMedia.mockResolvedValue(stream);
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    await svc.startStream({ audio: false, video: true });
    expect(svc.toggleMute()).toBe(false);
  });

  it('mutes the audio track and returns false', async () => {
    const { svc, stream } = await startAudioOnly();
    const track = stream.getAudioTracks()[0];
    track.enabled = true;
    const result = svc.toggleMute();
    expect(track.enabled).toBe(false);
    expect(result).toBe(false);
  });

  it('unmutes the audio track and returns true', async () => {
    const { svc, stream } = await startAudioOnly();
    const track = stream.getAudioTracks()[0];
    track.enabled = false;
    const result = svc.toggleMute();
    expect(track.enabled).toBe(true);
    expect(result).toBe(true);
  });

  it('toggles back and forth correctly', async () => {
    const { svc } = await startAudioOnly();
    expect(svc.toggleMute()).toBe(false); // true → false
    expect(svc.toggleMute()).toBe(true);  // false → true
    expect(svc.toggleMute()).toBe(false); // true → false
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getLocalStream()
// ─────────────────────────────────────────────────────────────────────────────

describe('getLocalStream()', () => {
  it('returns null before startStream', () => {
    const svc = new WebRTCService(wsClient, 'sess-1', true);
    expect(svc.getLocalStream()).toBeNull();
  });

  it('returns the active localStream', async () => {
    const { svc, stream } = await startAudioOnly();
    expect(svc.getLocalStream()).toBe(stream);
  });

  it('returns null after stopStream', async () => {
    const { svc } = await startAudioOnly();
    svc.stopStream();
    expect(svc.getLocalStream()).toBeNull();
  });
});
