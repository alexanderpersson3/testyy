import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
dotenv.config();
// Create the client instance
const elasticClient = new Client({
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || '',
    },
    tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
});
// Initialize indices and mappings
async function initializeElasticsearch() {
    try {
        // Check if ingredients index exists
        const indexExists = await elasticClient.indices.exists({
            index: 'ingredients',
        });
        if (!indexExists) {
            // Create ingredients index with mappings
            await elasticClient.indices.create({
                index: 'ingredients',
                body: {
                    mappings: {
                        properties: {
                            name: {
                                type: 'text',
                                analyzer: 'standard',
                                fields: {
                                    keyword: {
                                        type: 'keyword',
                                        ignore_above: 256,
                                    },
                                },
                            },
                            category: {
                                type: 'keyword',
                            },
                            alternativeTo: {
                                type: 'keyword',
                            },
                            nutritionalInfo: {
                                properties: {
                                    calories: { type: 'float' },
                                    protein: { type: 'float' },
                                    carbs: { type: 'float' },
                                    fat: { type: 'float' },
                                    fiber: { type: 'float' },
                                },
                            },
                            commonUnits: {
                                type: 'keyword',
                            },
                            priceHistory: {
                                type: 'nested',
                                properties: {
                                    date: { type: 'date' },
                                    price: { type: 'float' },
                                    store: { type: 'keyword' },
                                },
                            },
                            createdAt: { type: 'date' },
                            updatedAt: { type: 'date' },
                        },
                    },
                    settings: {
                        analysis: {
                            analyzer: {
                                standard: {
                                    type: 'standard',
                                    stopwords: '_english_',
                                },
                            },
                        },
                    },
                },
            });
            console.log('Created ingredients index with mappings');
        }
    }
    catch (err) {
        console.error('Error initializing Elasticsearch:', err);
        // Don't throw - allow app to start even if Elasticsearch is not available
    }
}
// Initialize on import
void initializeElasticsearch();
// Add health check method
const ping = async () => {
    try {
        await elasticClient.ping();
        return true;
    }
    catch (error) {
        console.error('Elasticsearch health check failed:', error);
        return false;
    }
};
// Add the ping method to the client
const enhancedClient = Object.assign(elasticClient, { ping });
export { enhancedClient as elasticClient };
//# sourceMappingURL=elastic-client.js.map