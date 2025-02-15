import { jest } from '@jest/globals';

export const WebSocketService = {
  getInstance: jest.fn().mockReturnValue({
    broadcast: jest.fn(),
    send: jest.fn()
  })
}; 