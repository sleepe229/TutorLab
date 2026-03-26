import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mocks are available before module-level vi.mock() calls
const mocks = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  const disconnect = vi.fn();
  const send = vi.fn();
  const subscribe = vi.fn(() => ({ unsubscribe }));
  let _connectCb = null;
  const connect = vi.fn((headers, cb) => { _connectCb = cb; });
  const socketClose = vi.fn();
  const stompClient = {
    get connected() { return stompClient._connected; },
    set connected(v) { stompClient._connected = v; },
    _connected: true,
    debug: null,
    connect,
    subscribe,
    send,
    disconnect,
  };
  const socket = { readyState: 1, close: socketClose, type: 'mockSocket' };
  return {
    unsubscribe, disconnect, send, subscribe, connect, stompClient, socket, socketClose,
    getConnectCb: () => _connectCb,
    resetCb: () => { _connectCb = null; },
  };
});

vi.mock('sockjs-client', () => ({
  default: function MockSockJS() { return mocks.socket; },
}));

vi.mock('stompjs', () => ({
  default: { over: vi.fn(() => mocks.stompClient) },
}));

vi.mock('../config.js', () => ({
  WS_URL: 'http://localhost:8080',
  API_BASE: '',
}));

import { connectToSession, connectToTutorUpdates } from '../services/wsClient.js';

// ── connectToTutorUpdates ─────────────────────────────────────────────────────

describe('wsClient — connectToTutorUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetCb();
    mocks.stompClient._connected = true;
    mocks.subscribe.mockReturnValue({ unsubscribe: mocks.unsubscribe });
  });

  it('returns empty disconnect when tutorIds is empty', () => {
    const { disconnect } = connectToTutorUpdates([]);
    expect(() => disconnect()).not.toThrow();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('connects via STOMP on mount', () => {
    connectToTutorUpdates(['tutor-1'], {});
    expect(mocks.connect).toHaveBeenCalled();
  });

  it('subscribes to /topic/tutor.{id}.live for each tutorId on connect', () => {
    connectToTutorUpdates(['tutor-1', 'tutor-2'], {});
    const cb = mocks.getConnectCb();
    if (cb) cb();

    expect(mocks.subscribe).toHaveBeenCalledWith(
      '/topic/tutor.tutor-1.live',
      expect.any(Function)
    );
    expect(mocks.subscribe).toHaveBeenCalledWith(
      '/topic/tutor.tutor-2.live',
      expect.any(Function)
    );
  });

  it('fires onLiveSession callback with parsed JSON when a frame arrives', () => {
    const onLiveSession = vi.fn();
    connectToTutorUpdates(['tutor-99'], { onLiveSession });
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const [[, frameHandler]] = mocks.subscribe.mock.calls;
    frameHandler({ body: JSON.stringify({ active: true, sessionId: 's1' }) });

    expect(onLiveSession).toHaveBeenCalledWith('tutor-99', { active: true, sessionId: 's1' });
  });

  it('disconnect() unsubscribes all topics and closes STOMP', () => {
    const { disconnect } = connectToTutorUpdates(['tutor-1'], {});
    const cb = mocks.getConnectCb();
    if (cb) cb();

    disconnect();

    expect(mocks.unsubscribe).toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalled();
  });

  it('disconnect() is idempotent — second call does nothing', () => {
    const { disconnect } = connectToTutorUpdates(['tutor-1'], {});
    disconnect();
    disconnect();
    // Should not throw and disconnect should be called at most once
    expect(mocks.disconnect.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

// ── connectToSession ──────────────────────────────────────────────────────────

describe('wsClient — connectToSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetCb();
    mocks.stompClient._connected = true;
    mocks.subscribe.mockReturnValue({ unsubscribe: mocks.unsubscribe });
  });

  it('subscribes to all 6 session topics on connect', () => {
    connectToSession('sess-1', {});
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const topics = mocks.subscribe.mock.calls.map(([t]) => t);
    expect(topics).toContain('/topic/session.sess-1.slide');
    expect(topics).toContain('/topic/session.sess-1.draw');
    expect(topics).toContain('/topic/session.sess-1.pointer');
    expect(topics).toContain('/topic/session.sess-1.clear');
    expect(topics).toContain('/topic/session.sess-1.presentation');
    expect(topics).toContain('/topic/session.sess-1.webrtc');
  });

  it('fires onSlideChange callback with parsed data', () => {
    const onSlideChange = vi.fn();
    connectToSession('sess-1', { onSlideChange });
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const slideCall = mocks.subscribe.mock.calls.find(([t]) => t.includes('.slide'));
    slideCall[1]({ body: JSON.stringify({ slideIndex: 3 }) });

    expect(onSlideChange).toHaveBeenCalledWith({ slideIndex: 3 });
  });

  it('fires onDraw callback with parsed data', () => {
    const onDraw = vi.fn();
    connectToSession('sess-2', { onDraw });
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const drawCall = mocks.subscribe.mock.calls.find(([t]) => t.includes('.draw'));
    drawCall[1]({ body: JSON.stringify({ x: 10, y: 20 }) });

    expect(onDraw).toHaveBeenCalledWith({ x: 10, y: 20 });
  });

  it('fires onWebRTC callback with parsed data', () => {
    const onWebRTC = vi.fn();
    connectToSession('sess-3', { onWebRTC });
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const rtcCall = mocks.subscribe.mock.calls.find(([t]) => t.includes('.webrtc'));
    rtcCall[1]({ body: JSON.stringify({ type: 'offer', sdp: '...' }) });

    expect(onWebRTC).toHaveBeenCalledWith({ type: 'offer', sdp: '...' });
  });

  it('sendDraw() calls stompClient.send with correct topic', () => {
    const { sendDraw } = connectToSession('sess-1', {});
    sendDraw({ x: 5, y: 10 });

    expect(mocks.send).toHaveBeenCalledWith(
      '/app/session/sess-1/draw',
      {},
      JSON.stringify({ x: 5, y: 10 })
    );
  });

  it('sendSlideChange() calls stompClient.send with correct topic', () => {
    const { sendSlideChange } = connectToSession('sess-1', {});
    sendSlideChange(2);

    expect(mocks.send).toHaveBeenCalledWith(
      '/app/session/sess-1/slide',
      {},
      JSON.stringify({ slideIndex: 2 })
    );
  });

  it('sendPointer() calls stompClient.send with correct topic', () => {
    const { sendPointer } = connectToSession('sess-1', {});
    sendPointer(0.5, 0.75);

    expect(mocks.send).toHaveBeenCalledWith(
      '/app/session/sess-1/pointer',
      {},
      JSON.stringify({ x: 0.5, y: 0.75 })
    );
  });

  it('sendClear() calls stompClient.send with correct topic', () => {
    const { sendClear } = connectToSession('sess-1', {});
    sendClear();

    expect(mocks.send).toHaveBeenCalledWith(
      '/app/session/sess-1/clear',
      {},
      JSON.stringify({})
    );
  });

  it('sendWebRTC() calls stompClient.send with correct topic', () => {
    const { sendWebRTC } = connectToSession('sess-1', {});
    sendWebRTC({ type: 'answer' });

    expect(mocks.send).toHaveBeenCalledWith(
      '/app/session/sess-1/webrtc',
      {},
      JSON.stringify({ type: 'answer' })
    );
  });

  it('send methods do nothing when disconnected', () => {
    mocks.stompClient._connected = false;
    const { sendDraw, sendSlideChange, sendPointer, sendClear, sendWebRTC } = connectToSession('sess-1', {});
    sendDraw({}); sendSlideChange(0); sendPointer(0, 0); sendClear(); sendWebRTC({});

    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('disconnect() unsubscribes from all topics and disconnects STOMP', () => {
    const { disconnect } = connectToSession('sess-1', {});
    const cb = mocks.getConnectCb();
    if (cb) cb();

    disconnect();

    expect(mocks.unsubscribe).toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalled();
  });

  it('fires onConnect callback when connection is established', () => {
    const onConnect = vi.fn();
    connectToSession('sess-1', { onConnect });
    const cb = mocks.getConnectCb();
    if (cb) cb();

    expect(onConnect).toHaveBeenCalled();
  });
});
