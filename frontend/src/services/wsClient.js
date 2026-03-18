// src/services/wsClient.js
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { WS_URL } from '../config.js';

/**
 * Subscribes to live-session start/end events for a list of tutor IDs.
 * Fires callbacks.onLiveSession(tutorId, { active, sessionId? }) on each event.
 * Call the returned disconnect() when the component unmounts.
 */
export const connectToTutorUpdates = (tutorIds, callbacks = {}) => {
  if (!tutorIds.length) return { disconnect: () => {} };

  const socket = new SockJS(`${WS_URL}/ws`);
  const stompClient = Stomp.over(socket);
  stompClient.debug = () => {};
  const subscriptions = [];
  let isDisconnected = false;

  stompClient.connect({}, () => {
    tutorIds.forEach(tutorId => {
      const sub = stompClient.subscribe(
        `/topic/tutor.${tutorId}.live`,
        (message) => callbacks.onLiveSession?.(tutorId, JSON.parse(message.body))
      );
      subscriptions.push(sub);
    });
  }, (error) => {
    console.error('Tutor updates WebSocket connection error:', error);
    callbacks.onError?.(error);
  });

  return {
    disconnect: () => {
      if (isDisconnected) return;
      isDisconnected = true;
      subscriptions.forEach(sub => sub.unsubscribe());
      subscriptions.length = 0;
      if (stompClient?.connected) stompClient.disconnect();
      if (socket.readyState < 2) socket.close(); // CONNECTING or OPEN
    },
  };
};

export const connectToSession = (sessionId, callbacks = {}) => {
  let stompClient = null;
  let subscriptions = {};

  const socket = new SockJS(`${WS_URL}/ws`);
  stompClient = Stomp.over(socket);

  stompClient.debug = () => {};

  stompClient.connect({}, () => {
    subscriptions['presentation'] = stompClient.subscribe(
      `/topic/session.${sessionId}.presentation`,
      (message) => {
        const data = JSON.parse(message.body);
        callbacks.onPresentationUpdate?.(data);
      }
    );

    subscriptions['slide'] = stompClient.subscribe(
      `/topic/session.${sessionId}.slide`,
      (message) => {
        const data = JSON.parse(message.body);
        callbacks.onSlideChange?.(data);
      }
    );

    subscriptions['draw'] = stompClient.subscribe(
      `/topic/session.${sessionId}.draw`,
      (message) => {
        const data = JSON.parse(message.body);
        callbacks.onDraw?.(data);
      }
    );

    subscriptions['pointer'] = stompClient.subscribe(
      `/topic/session.${sessionId}.pointer`,
      (message) => {
        const data = JSON.parse(message.body);
        callbacks.onPointer?.(data);
      }
    );

    subscriptions['clear'] = stompClient.subscribe(
      `/topic/session.${sessionId}.clear`,
      () => callbacks.onClear?.()
    );

    subscriptions['webrtc'] = stompClient.subscribe(
      `/topic/session.${sessionId}.webrtc`,
      (message) => {
        const data = JSON.parse(message.body);
        callbacks.onWebRTC?.(data);
      }
    );

    callbacks.onConnect?.();
  }, (error) => {
    console.error('WebSocket connection error:', error);
    callbacks.onError?.(error);
  });

  return {
    sendDraw: (data) => {
      if (stompClient?.connected)
        stompClient.send(`/app/session/${sessionId}/draw`, {}, JSON.stringify(data));
    },

    sendSlideChange: (slideIndex) => {
      if (stompClient?.connected)
        stompClient.send(`/app/session/${sessionId}/slide`, {}, JSON.stringify({ slideIndex }));
    },

    sendPointer: (x, y) => {
      if (stompClient?.connected)
        stompClient.send(`/app/session/${sessionId}/pointer`, {}, JSON.stringify({ x, y }));
    },

    sendClear: () => {
      if (stompClient?.connected)
        stompClient.send(`/app/session/${sessionId}/clear`, {}, JSON.stringify({}));
    },

    sendWebRTC: (data) => {
      if (stompClient?.connected)
        stompClient.send(`/app/session/${sessionId}/webrtc`, {}, JSON.stringify(data));
    },

    disconnect: () => {
      Object.values(subscriptions).forEach(sub => sub.unsubscribe());
      if (stompClient?.connected) stompClient.disconnect();
    },
  };
};
