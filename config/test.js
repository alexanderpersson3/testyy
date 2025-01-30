import { taskManager } from './tasks.js';

// Mock task manager implementation
const mockTaskManager = {
  createQueue: jest.fn().mockResolvedValue({}),
  createTask: jest.fn().mockResolvedValue({ name: 'mock-task-id' }),
  deleteTask: jest.fn().mockResolvedValue(),
  listTasks: jest.fn().mockResolvedValue([]),
  pauseQueue: jest.fn().mockResolvedValue(),
  resumeQueue: jest.fn().mockResolvedValue()
};

jest.mock('./tasks.js', () => ({
  taskManager: mockTaskManager
}));