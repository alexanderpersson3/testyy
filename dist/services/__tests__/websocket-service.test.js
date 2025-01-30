import { WebSocketService } from '../websocket-service';
import { createServer } from 'http';
import { WebSocket } from 'ws';
import { generateToken } from '../../utils/auth';
describe('WebSocketService', () => {
    let httpServer;
    let wsService;
    let port;
    const testUserId = '507f1f77bcf86cd799439011';
    const activeConnections = new Set();
    beforeAll(async () => {
        // Create HTTP server
        httpServer = createServer();
        // Start the server
        await new Promise((resolve) => {
            httpServer.listen(0, 'localhost', () => {
                const addr = httpServer.address();
                if (addr && typeof addr === 'object') {
                    port = addr.port;
                    console.log(`HTTP server listening on port ${port}`);
                    resolve();
                }
            });
        });
        // Create WebSocket service
        wsService = new WebSocketService(httpServer);
        // Wait for WebSocket server to be ready
        await wsService.waitForReady();
        console.log('WebSocket server is ready');
    });
    afterAll(async () => {
        // Close all active connections
        for (const ws of activeConnections) {
            try {
                ws.terminate();
            }
            catch (error) {
                // Ignore errors during cleanup
            }
        }
        activeConnections.clear();
        // Close servers
        await wsService.close();
        await new Promise((resolve) => {
            httpServer.close(() => resolve());
        });
        // Wait for everything to clean up
        await new Promise(resolve => setTimeout(resolve, 1000));
    });
    afterEach(async () => {
        // Close all active connections
        for (const ws of activeConnections) {
            try {
                ws.terminate();
            }
            catch (error) {
                // Ignore errors during cleanup
            }
        }
        activeConnections.clear();
        // Wait for connections to close
        await new Promise(resolve => setTimeout(resolve, 100));
    });
    const createWebSocket = (token) => {
        const url = `ws://localhost:${port}${token ? `?token=${token}` : ''}`;
        return new Promise((resolve, reject) => {
            console.log(`Attempting to connect to ${url}`);
            const ws = new WebSocket(url, {
                followRedirects: true,
                handshakeTimeout: 5000,
                perMessageDeflate: false
            });
            activeConnections.add(ws);
            const timeout = setTimeout(() => {
                console.log('Connection attempt timed out');
                ws.terminate();
                reject(new Error('WebSocket connection timed out'));
            }, 5000);
            ws.on('error', (error) => {
                console.log('WebSocket error:', error.message);
                clearTimeout(timeout);
                reject(error);
            });
            ws.on('open', () => {
                console.log('WebSocket connection opened');
                clearTimeout(timeout);
                resolve(ws);
            });
            ws.on('close', (code, reason) => {
                console.log(`WebSocket closed with code ${code}${reason ? `: ${reason}` : ''}`);
                clearTimeout(timeout);
                activeConnections.delete(ws);
            });
        });
    };
    it('should handle client connections and messages', async () => {
        const token = generateToken({
            id: testUserId,
            email: 'test@example.com',
            role: 'user'
        });
        console.log('Starting connection test with valid token');
        const ws = await createWebSocket(token);
        try {
            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.log('No response received for ping message');
                    reject(new Error('No response received'));
                }, 5000);
                const messageHandler = (data) => {
                    console.log('Received message:', data.toString());
                    try {
                        const message = JSON.parse(data.toString());
                        clearTimeout(timeout);
                        ws.removeListener('message', messageHandler);
                        resolve(message);
                    }
                    catch (error) {
                        console.log('Error parsing message:', error);
                        clearTimeout(timeout);
                        ws.removeListener('message', messageHandler);
                        reject(error);
                    }
                };
                ws.on('message', messageHandler);
                console.log('Sending ping message');
                ws.send(JSON.stringify({ type: 'ping' }));
            });
            expect(response).toEqual({ type: 'pong' });
        }
        finally {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        }
    });
    it('should reject connections without token', async () => {
        console.log('Starting connection test without token');
        const ws = await createWebSocket();
        const code = await new Promise((resolve) => {
            ws.on('close', (code) => {
                console.log(`Connection closed with code ${code}`);
                resolve(code);
            });
        });
        expect(code).toBe(1008);
    });
    it('should reject connections with invalid token', async () => {
        console.log('Starting connection test with invalid token');
        const ws = await createWebSocket('invalid');
        const code = await new Promise((resolve) => {
            ws.on('close', (code) => {
                console.log(`Connection closed with code ${code}`);
                resolve(code);
            });
        });
        expect(code).toBe(1008);
    });
});
//# sourceMappingURL=websocket-service.test.js.map