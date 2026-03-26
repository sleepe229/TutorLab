/**
 * Chat WebSocket client — connects to /ws (same STOMP endpoint as live sessions)
 * but subscribes to /topic/chat.{chatId} for real-time messaging.
 *
 * Usage:
 *   const { subscribe, send, disconnect } = connectChatWs(chatId, onMessage);
 *   // send a message
 *   send({ type: 'TEXT', text: '...', senderId, senderRole, senderName });
 *   // cleanup
 *   disconnect();
 */

import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { WS_URL } from '../config.js';

/**
 * Per-user WebSocket subscription for chat list events.
 * Subscribes to /topic/user.{userId} and delivers CHAT_UPDATED,
 * CHAT_ADDED, and CHAT_REMOVED events to the caller.
 *
 * @param {string} userId - The logged-in user's ID
 * @param {function} onEvent - Called with the parsed event object
 * @returns {{ disconnect: function }}
 */
export function connectUserWs(userId, onEvent) {
  const socket = new SockJS(`${WS_URL}/ws`);
  const client = Stomp.over(socket);
  client.debug = null;

  client.connect({}, () => {
    client.subscribe(`/topic/user.${userId}`, (frame) => {
      try {
        onEvent(JSON.parse(frame.body));
      } catch { /* ignore malformed */ }
    });
  });

  return {
    disconnect: () => { if (client.connected) client.disconnect(); },
  };
}

export function connectChatWs(chatId, onMessage) {
  const socket = new SockJS(`${WS_URL}/ws`);
  const client = Stomp.over(socket);
  client.debug = null; // silence logs

  let subscription = null;

  client.connect({}, () => {
    subscription = client.subscribe(`/topic/chat.${chatId}`, (frame) => {
      try {
        const msg = JSON.parse(frame.body);
        onMessage(msg);
      } catch { /* ignore malformed */ }
    });
  });

  const send = (payload) => {
    if (client.connected) {
      client.send(`/app/chat/${chatId}/message`, {}, JSON.stringify(payload));
    }
  };

  const disconnect = () => {
    if (subscription) subscription.unsubscribe();
    if (client.connected) client.disconnect();
  };

  return { send, disconnect };
}
