let mockDb = null;

/**
 * Sets the mock database instance for testing
 * @param {object} db - The MongoDB database instance
 */
function setMockDb(db) {
  mockDb = db;
}

/**
 * Gets the mock database instance
 * @returns {object} The MongoDB database instance
 */
function getMockDb() {
  if (!mockDb) {
    throw new Error('Mock database not initialized');
  }
  return mockDb;
}

/**
 * Clears the mock database instance
 */
function clearMockDb() {
  mockDb = null;
}

export { setMockDb, getMockDb, clearMockDb };
