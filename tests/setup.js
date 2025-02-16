// Mock environment variables
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.REDIS_DB = '0';

// Increase timeout for all tests
jest.setTimeout(60000);

// Add any other global test setup here 