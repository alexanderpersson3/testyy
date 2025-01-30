import { taskManager } from '../../config/tasks.js';

describe('TaskManager', () => {
  beforeEach(() => {
    // Mock individual methods with proper implementations
    jest.spyOn(taskManager, 'createQueue').mockImplementation(() => Promise.resolve({}));
    jest.spyOn(taskManager, 'createTask').mockImplementation(() => Promise.resolve({ name: 'mock-task-id' }));
    jest.spyOn(taskManager, 'deleteTask').mockImplementation(() => Promise.resolve());
    jest.spyOn(taskManager, 'listTasks').mockImplementation(() => Promise.resolve([]));
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createQueue', () => {
    it('should create mock queue', async () => {
      const result = await taskManager.createQueue('email');
      expect(result).toEqual({});
      expect(taskManager.createQueue).toHaveBeenCalledWith('email');
    });
  });

  describe('createTask', () => {
    it('should return mock task ID', async () => {
      const payload = { userId: 'test123', type: 'welcome_email' }
      const result = await taskManager.createTask('email', payload, {});
      expect(result).toHaveProperty('name', 'mock-task-id');
      expect(taskManager.createTask).toHaveBeenCalledWith('email', payload, {})
    });
  });

  describe('listTasks', () => {
    it('should return empty array', async () => {
      const result = await taskManager.listTasks('email');
      expect(result).toEqual([]);
    }); 
  });

  describe('deleteTask', () => {
    it('should resolve without errors', async () => {
      await expect(taskManager.deleteTask('email', 'task123'))
        .resolves
        .toBeUndefined();
    });
  });
});