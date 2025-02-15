import express from 'express';
import { createServer } from 'http';;
import { WebSocketService } from '../services/websocket-service.js';;
import { setupMiddleware } from '../middleware/index.js';;
import { setupRoutes } from '../routes/index.js';;
import instrument from '../utils/instrument.js';
import logger from '../utils/logger.js';
import { initializeDirectories, cleanupTempFiles } from '../utils/init.js';;

const app = express();
const server = createServer(app);
const wsService = WebSocketService.getInstance();

// Attach WebSocket server to HTTP server
wsService.attachToServer(server);

// Setup middleware
setupMiddleware(app);

// Setup routes
setupRoutes(app);

// Setup error handling and instrumentation
instrument(app);

async function startServer() {
  try {
    // Initialize required directories
    await initializeDirectories();

    // Clean up any leftover temporary files
    await cleanupTempFiles();

    // Start the server
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });

    // Set up cleanup on server shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Cleaning up...');
      await cleanupTempFiles();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received. Cleaning up...');
      await cleanupTempFiles();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
