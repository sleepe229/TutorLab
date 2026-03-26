import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so mocks are available before module-level vi.mock() calls
const mocks = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  const disconnect = vi.fn();
  const send = vi.fn();
  const subscribe = vi.fn(() => ({ unsubscribe }));
  let _connectCb = null;
  const connect = vi.fn((headers, cb) => { _connectCb = cb; });
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
  return { unsubscribe, disconnect, send, subscribe, connect, stompClient,
           getConnectCb: () => _connectCb, resetCb: () => { _connectCb = null; } };
});

vi.mock('sockjs-client', () => ({
  default: function MockSockJS() { return { type: 'mockSocket' }; },
}));

vi.mock('stompjs', () => ({
  default: { over: vi.fn(() => mocks.stompClient) },
}));

vi.mock('../config.js', () => ({
  WS_URL: 'http://localhost:8080',
  API_BASE: '',
}));

import { connectChatWs, connectUserWs } from '../services/chatWsClient.js';

describe('chatWsClient — connectChatWs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetCb();
    mocks.stompClient._connected = true;
    // Restore subscribe return value after clearAllMocks resets its return
    mocks.subscribe.mockReturnValue({ unsubscribe: mocks.unsubscribe });
  });

  it('creates a SockJS connection to /ws', () => {
    connectChatWs('chat-1', vi.fn());
    // Just verify connect was called — SockJS is constructed inside the function
    expect(mocks.connect).toHaveBeenCalled();
  });

  it('subscribes to /topic/chat.{chatId} on connect', () => {
    connectChatWs('chat-42', vi.fn());
    const cb = mocks.getConnectCb();
    if (cb) cb();

    expect(mocks.subscribe).toHaveBeenCalledWith(
      '/topic/chat.chat-42',
      expect.any(Function)
    );
  });

  it('calls onMessage with parsed JSON when a frame arrives', () => {
    const onMessage = vi.fn();
    connectChatWs('chat-1', onMessage);
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const [[, frameHandler]] = mocks.subscribe.mock.calls;
    frameHandler({ body: JSON.stringify({ type: 'TEXT', text: 'Hello' }) });

    expect(onMessage).toHaveBeenCalledWith({ type: 'TEXT', text: 'Hello' });
  });

  it('silently ignores malformed JSON frames', () => {
    const onMessage = vi.fn();
    connectChatWs('chat-1', onMessage);
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const [[, frameHandler]] = mocks.subscribe.mock.calls;
    expect(() => frameHandler({ body: '{invalid json' })).not.toThrow();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('send() forwards payload as JSON when connected', () => {
    const { send } = connectChatWs('chat-1', vi.fn());
    const payload = { type: 'TEXT', text: 'Hi', senderId: 's1' };
    send(payload);

    expect(mocks.send).toHaveBeenCalledWith(
      '/app/chat/chat-1/message',
      {},
      JSON.stringify(payload)
    );
  });

  it('send() does nothing when disconnected', () => {
    mocks.stompClient._connected = false;
    const { send } = connectChatWs('chat-1', vi.fn());
    send({ type: 'TEXT', text: 'Hi' });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('disconnect() unsubscribes from topic and disconnects STOMP', () => {
    const { disconnect } = connectChatWs('chat-1', vi.fn());
    const cb = mocks.getConnectCb();
    if (cb) cb(); // create subscription

    disconnect();
    expect(mocks.unsubscribe).toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalled();
  });

  it('disconnect() is safe to call before connection is established', () => {
    const { disconnect } = connectChatWs('chat-1', vi.fn());
    // connectCallback never fired — subscription is null
    expect(() => disconnect()).not.toThrow();
  });
});

describe('chatWsClient — connectUserWs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetCb();
    mocks.stompClient._connected = true;
    mocks.subscribe.mockReturnValue({ unsubscribe: mocks.unsubscribe });
  });

  it('subscribes to /topic/user.{userId} on connect', () => {
    connectUserWs('user-99', vi.fn());
    const cb = mocks.getConnectCb();
    if (cb) cb();

    expect(mocks.subscribe).toHaveBeenCalledWith(
      '/topic/user.user-99',
      expect.any(Function)
    );
  });

  it('calls onEvent with parsed JSON when a user event arrives', () => {
    const onEvent = vi.fn();
    connectUserWs('user-99', onEvent);
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const [[, frameHandler]] = mocks.subscribe.mock.calls;
    frameHandler({ body: JSON.stringify({ type: 'CHAT_UPDATED', chatId: 'c1' }) });

    expect(onEvent).toHaveBeenCalledWith({ type: 'CHAT_UPDATED', chatId: 'c1' });
  });

  it('silently ignores malformed JSON in user event frames', () => {
    const onEvent = vi.fn();
    connectUserWs('user-1', onEvent);
    const cb = mocks.getConnectCb();
    if (cb) cb();

    const [[, frameHandler]] = mocks.subscribe.mock.calls;
    expect(() => frameHandler({ body: 'not-json' })).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('disconnect() closes the STOMP connection', () => {
    const { disconnect } = connectUserWs('user-99', vi.fn());
    disconnect();
    expect(mocks.disconnect).toHaveBeenCalled();
  });
});
