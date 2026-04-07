// src/services/wsClient.js
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { WS_URL } from '../config.js';

const RECONNECT_BASE_MS  = 1_500;
const RECONNECT_MAX_MS   = 30_000;
const RECONNECT_JITTER_MS = 500;

function jitteredDelay(attempt) {
  const exp = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
  return exp + Math.random() * RECONNECT_JITTER_MS;
}

/**
 * Subscribes to live-session start/end events for a list of tutor IDs.
 * Fires callbacks.onLiveSession(tutorId, { active, sessionId? }) on each event.
 * Call the returned disconnect() when the component unmounts.
 */
export const connectToTutorUpdates = (tutorIds, callbacks = {}) => {
  if (!tutorIds.length) return { disconnect: () => {} };

  let stompClient      = null;
  let currentSocket    = null;
  let subscriptions    = [];
  let isDisconnected   = false;
  let reconnectTimer   = null;
  let reconnectAttempt = 0;

  const doConnect = () => {
    try { currentSocket?.close(); } catch (_) {}
    currentSocket = new SockJS(`${WS_URL}/ws`);
    stompClient = Stomp.over(currentSocket);
    stompClient.debug = () => {};

    stompClient.connect({}, () => {
      reconnectAttempt = 0;
      tutorIds.forEach(tutorId => {
        const sub = stompClient.subscribe(
          `/topic/tutor.${tutorId}.live`,
          (message) => callbacks.onLiveSession?.(tutorId, JSON.parse(message.body))
        );
        subscriptions.push(sub);
      });
    }, () => {
      if (isDisconnected) return;
      const delay = jitteredDelay(reconnectAttempt++);
      reconnectTimer = setTimeout(doConnect, delay);
    });
  };

  doConnect();

  return {
    disconnect: () => {
      if (isDisconnected) return;
      isDisconnected = true;
      clearTimeout(reconnectTimer);
      subscriptions.forEach(sub => { try { sub.unsubscribe(); } catch (_) {} });
      subscriptions = [];
      try { if (stompClient?.connected) stompClient.disconnect(); } catch (_) {}
      try { currentSocket?.close(); } catch (_) {}
      currentSocket = null;
    },
  };
};

/**
 * Connects to a live session over STOMP/WebSocket.
 *
 * Features:
 *  - Automatic reconnect with exponential back-off + jitter (1.5 s → 30 s).
 *  - Re-subscribes to all topics and re-fires onConnect on each reconnection.
 *  - Callers are responsible for re-announcing presence in onConnect.
 *
 * Returns an object with send helpers and a disconnect() method.
 */
export const connectToSession = (sessionId, callbacks = {}) => {
  let stompClient      = null;
  let currentSocket    = null;
  let subscriptions    = {};
  let isDisconnected   = false;
  let reconnectTimer   = null;
  let reconnectAttempt = 0;

  const subscribe = () => {
    subscriptions['presentation'] = stompClient.subscribe(
      `/topic/session.${sessionId}.presentation`,
      (msg) => callbacks.onPresentationUpdate?.(JSON.parse(msg.body))
    );
    subscriptions['slide'] = stompClient.subscribe(
      `/topic/session.${sessionId}.slide`,
      (msg) => callbacks.onSlideChange?.(JSON.parse(msg.body))
    );
    subscriptions['draw'] = stompClient.subscribe(
      `/topic/session.${sessionId}.draw`,
      (msg) => callbacks.onDraw?.(JSON.parse(msg.body))
    );
    subscriptions['pointer'] = stompClient.subscribe(
      `/topic/session.${sessionId}.pointer`,
      (msg) => callbacks.onPointer?.(JSON.parse(msg.body))
    );
    subscriptions['clear'] = stompClient.subscribe(
      `/topic/session.${sessionId}.clear`,
      () => callbacks.onClear?.()
    );
    subscriptions['webrtc'] = stompClient.subscribe(
      `/topic/session.${sessionId}.webrtc`,
      (msg) => callbacks.onWebRTC?.(JSON.parse(msg.body))
    );

    // Notify caller — they should (re)send presence here
    callbacks.onConnect?.();
  };

  const doConnect = () => {
    // Always create a fresh SockJS socket on each attempt
    try { currentSocket?.close(); } catch (_) {}
    currentSocket = new SockJS(`${WS_URL}/ws`);
    stompClient = Stomp.over(currentSocket);
    stompClient.debug = () => {};

    stompClient.connect({}, () => {
      reconnectAttempt = 0;
      subscribe();
    }, () => {
      // STOMP error / disconnection — schedule reconnect unless torn down manually
      if (isDisconnected) return;
      const delay = jitteredDelay(reconnectAttempt++);
      console.warn(`[WS] Disconnected. Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempt})`);
      reconnectTimer = setTimeout(doConnect, delay);
    });
  };

  doConnect();

  // ── Send helpers ────────────────────────────────────────────────────

  const send = (path, data) => {
    if (stompClient?.connected)
      stompClient.send(`/app/session/${sessionId}/${path}`, {}, JSON.stringify(data));
  };

  return {
    sendDraw:    (data)      => send('draw', data),
    sendSlideChange: (idx)   => send('slide', { slideIndex: idx }),
    sendPointer: (x, y)      => send('pointer', { x, y }),
    sendClear:   ()          => send('clear', {}),
    sendWebRTC:  (data)      => send('webrtc', data),

    // Notify the other side about local camera/screen state change.
    sendMediaState: (from, hasVideo) =>
      send('webrtc', { type: 'media-state', from, hasVideo }),

    // Tell the other side to destroy its current peer (e.g. before screen-share toggle).
    sendForceReconnect: (from) =>
      send('webrtc', { type: 'force-reconnect', from }),

    // Announce own presence so the other side can re-initiate their stream.
    sendPresence: (role) =>
      send('webrtc', { type: 'presence', role }),

    disconnect: () => {
      if (isDisconnected) return;
      isDisconnected = true;
      clearTimeout(reconnectTimer);
      Object.values(subscriptions).forEach(sub => { try { sub.unsubscribe(); } catch (_) {} });
      subscriptions = {};
      try { if (stompClient?.connected) stompClient.disconnect(); } catch (_) {}
      try { currentSocket?.close(); } catch (_) {}
      currentSocket = null;
    },
  };
};
