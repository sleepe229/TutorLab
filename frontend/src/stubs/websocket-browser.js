// Browser stub for the Node.js 'websocket' package.
// stompjs conditionally requires 'websocket' for Node environments; browsers have native WebSocket.
export const w3cwebsocket = typeof WebSocket !== 'undefined' ? WebSocket : null;
export default { w3cwebsocket };
