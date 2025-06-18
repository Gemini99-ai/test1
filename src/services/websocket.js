// src/services/websocket.js

let ws = null;

const connectWebSocket = () => {
  // If a connection exists and is open or connecting, do nothing.
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws`;

  console.log('Attempting to connect WebSocket...');
  ws = new WebSocket(wsUrl);

  ws.onclose = () => {
    console.log('WebSocket Disconnected');
    ws = null; // Clear the instance on close
  };

  ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
    ws = null; // Clear the instance on error
  };

  return ws;
};

const disconnectWebSocket = () => {
  if (ws) {
    ws.close();
  }
};

const sendRequest = (type, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  } else {
    console.error('WebSocket is not connected. Cannot send message.');
  }
};

// Exporting the ws instance allows other parts of the app to attach listeners
export { 
    ws, 
    connectWebSocket, 
    disconnectWebSocket, 
    sendRequest 
};
