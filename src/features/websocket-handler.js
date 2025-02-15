const { WebSocketMessageType } = require('../constants');
const WebSocket = require('ws');

const log = (message, ...args) => {
  console.log(`[WebSocketHandler] ${message}`, ...args);
};

const handleMessage = (ws, user, data) => {
  log("Received message from user", user, "data:", data);
  try {
    const message = JSON.parse(data);
    
    switch(message.type) {
      case WebSocketMessageType.SHOPPING_LIST_UPDATE:
        log("Handling shopping list update for user", user);
        handleShoppingListUpdate(ws, user, message.payload);
        break;
      case WebSocketMessageType.RECIPE_COLLABORATION:
        log("Handling recipe collaboration for user", user);
        handleRecipeCollaboration(ws, user, message.payload);
        break;
      default:
        log("Invalid message type received:", message.type);
        ws.send(JSON.stringify({ error: 'Invalid message type' }));
    }
  } catch (error) {
    log("Error parsing message:", error.message, "Data:", data);
    ws.send(JSON.stringify({ 
      error: 'Invalid message format',
      details: error.message 
    }));
  }
};

const clients = new Set();

const handleShoppingListUpdate = (ws, user, payload) => {
  log("Shopping list update payload", payload, "for user", user);
  // Implement shopping list synchronization logic
};

const handleRecipeCollaboration = (ws, user, payload) => {
  log("Received recipe collaboration payload", payload, "for user", user);
  clients.add(ws);
  // Implement real-time recipe editing logic
  clients.forEach(client => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      log("Broadcasting recipe collaboration to client");
      client.send(JSON.stringify({
        type: WebSocketMessageType.RECIPE_COLLABORATION,
        payload: payload
      }));
    }
  });
};

const setupWebSocket = (ws, user) => {
  log("New connection established for user", user);
  ws.on('message', data => handleMessage(ws, user, data));
  ws.on('close', () => {
    log("Connection closed for user", user);
    // Reconnection is typically handled on the client side.
  });
  ws.on('error', error => {
    log("Connection error for user", user, "Error:", error.message);
  });
};

module.exports = { handleMessage, setupWebSocket };
