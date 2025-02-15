interface ServerCheckResult {
  isRunning: boolean;
  services: {
    http: boolean;
    websocket: boolean;
    recipeService: boolean;
  };
  details: string[];
}

export const checkServerStatus = async (): Promise<ServerCheckResult> => {
  const result: ServerCheckResult = {
    isRunning: false,
    services: {
      http: false,
      websocket: false,
      recipeService: false
    },
    details: []
  };

  try {
    // Check HTTP API
    const httpResponse = await fetch('http://localhost:3001/health');
    result.services.http = httpResponse.status === 200;
    result.details.push(
      result.services.http 
        ? '✅ HTTP API is running' 
        : '❌ HTTP API is not responding correctly'
    );

    // Check WebSocket
    try {
      const ws = new WebSocket('ws://localhost:3001');
      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          result.services.websocket = true;
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 3000);
      });
    } catch (err) {
      result.services.websocket = false;
    }
    result.details.push(
      result.services.websocket 
        ? '✅ WebSocket connection is available' 
        : '❌ WebSocket connection failed'
    );

    // Check Recipe Service
    try {
      const recipeResponse = await fetch('http://localhost:3001/api/recipes/health');
      result.services.recipeService = recipeResponse.status === 200;
    } catch (err) {
      result.services.recipeService = false;
    }
    result.details.push(
      result.services.recipeService 
        ? '✅ Recipe service is running' 
        : '❌ Recipe service is not responding'
    );

    // Overall status
    result.isRunning = result.services.http && 
                      result.services.websocket && 
                      result.services.recipeService;

  } catch (error) {
    result.details.push('❌ Server is completely unavailable');
    result.isRunning = false;
  }

  return result;
};
