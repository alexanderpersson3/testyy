import { WebSocket } from 'ws';
import { WebSocketMessageType } from '../constants';

interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
}

interface ShoppingListUpdatePayload {
  listId: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unit?: string;
    checked: boolean;
  }>;
}

interface RecipeCollaborationPayload {
  recipeId: string;
  changes: Array<{
    type: 'add' | 'update' | 'delete';
    path: string;
    value: any;
  }>;
  timestamp: number;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

const log = (message: string, ...args: any[]): void => {
  console.log(`[WebSocketHandler] ${message}`, ...args);
};

const handleMessage = (ws: WebSocket, user: string, data: string): void => {
  log("Received message from user", user, "data:", data);
  try {
    const message = JSON.parse(data) as WebSocketMessage;
    
    switch(message.type) {
      case WebSocketMessageType.SHOPPING_LIST_UPDATE:
        log("Handling shopping list update for user", user);
        handleShoppingListUpdate(ws, user, message.payload as ShoppingListUpdatePayload);
        break;
      case WebSocketMessageType.RECIPE_COLLABORATION:
        log("Handling recipe collaboration for user", user);
        handleRecipeCollaboration(ws, user, message.payload as RecipeCollaborationPayload);
        break;
      default:
        log("Invalid message type received:", message.type);
        ws.send(JSON.stringify({ error: 'Invalid message type' } as ErrorResponse));
    }
  } catch (error) {
    log("Error parsing message:", (error as Error).message, "Data:", data);
    ws.send(JSON.stringify({ 
      error: 'Invalid message format',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as ErrorResponse));
  }
};

const clients = new Set<WebSocket>();

const handleShoppingListUpdate = (
  ws: WebSocket, 
  user: string, 
  payload: ShoppingListUpdatePayload
): void => {
  log("Shopping list update payload", payload, "for user", user);
  // Implement shopping list synchronization logic
};

const handleRecipeCollaboration = (
  ws: WebSocket, 
  user: string, 
  payload: RecipeCollaborationPayload
): void => {
  log("Received recipe collaboration payload", payload, "for user", user);
  clients.add(ws);
  // Implement real-time recipe editing logic
  clients.forEach(client => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      log("Broadcasting recipe collaboration to client");
      client.send(JSON.stringify({
        type: WebSocketMessageType.RECIPE_COLLABORATION,
        payload: payload
      } as WebSocketMessage));
    }
  });
};

const setupWebSocket = (ws: WebSocket, user: string): void => {
  log("New connection established for user", user);
  ws.on('message', (data: string) => handleMessage(ws, user, data));
  ws.on('close', () => {
    log("Connection closed for user", user);
    clients.delete(ws);
    // Reconnection is typically handled on the client side.
  });
  ws.on('error', (error: Error) => {
    log("Connection error for user", user, "Error:", error.message);
  });
};

export { handleMessage, setupWebSocket, WebSocketMessage, ShoppingListUpdatePayload, RecipeCollaborationPayload }; 