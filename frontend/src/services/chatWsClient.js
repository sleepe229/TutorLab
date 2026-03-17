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
