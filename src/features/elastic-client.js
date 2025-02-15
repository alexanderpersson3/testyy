const { Client } = require('@elastic/elasticsearch');

// Create Elasticsearch client
const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
  },
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
  maxRetries: 3,
  requestTimeout: 30000,
  sniffOnStart: true,
  sniffInterval: 300000, // Sniff every 5 minutes
  sniffOnConnectionFault: true,
  resurrectStrategy: 'ping',
});

// Health check function
async function checkHealth() {
  try {
    const health = await client.cluster.health();
    console.log('Elasticsearch cluster health:', health);
    return health;
  } catch (error) {
    console.error('Elasticsearch health check failed:', error);
    throw error;
  }
}

// Ping function to check if cluster is available
async function ping() {
  try {
    const result = await client.ping();
    console.log('Elasticsearch cluster is available');
    return result;
  } catch (error) {
    console.error('Elasticsearch cluster is not available:', error);
    throw error;
  }
}

// Get cluster info
async function getInfo() {
  try {
    const info = await client.info();
    console.log('Elasticsearch cluster info:', info);
    return info;
  } catch (error) {
    console.error('Failed to get Elasticsearch cluster info:', error);
    throw error;
  }
}

// Get cluster stats
async function getStats() {
  try {
    const stats = await client.cluster.stats();
    console.log('Elasticsearch cluster stats:', stats);
    return stats;
  } catch (error) {
    console.error('Failed to get Elasticsearch cluster stats:', error);
    throw error;
  }
}

// Initialize function to check connection and setup
async function initialize() {
  try {
    // Check if cluster is available
    await ping();

    // Get cluster info
    await getInfo();

    // Check cluster health
    const health = await checkHealth();

    // Get cluster stats
    await getStats();

    console.log('Elasticsearch client initialized successfully');
    return health.status === 'green';
  } catch (error) {
    console.error('Failed to initialize Elasticsearch client:', error);
    throw error;
  }
}

// Export client and utility functions
module.exports = {
  client,
  checkHealth,
  ping,
  getInfo,
  getStats,
  initialize,
  // Proxy common client methods for convenience
  index: (...args) => client.index(...args),
  search: (...args) => client.search(...args),
  bulk: (...args) => client.bulk(...args),
  delete: (...args) => client.delete(...args),
  update: (...args) => client.update(...args),
  exists: (...args) => client.exists(...args),
  count: (...args) => client.count(...args),
  indices: client.indices,
  cluster: client.cluster,
};
