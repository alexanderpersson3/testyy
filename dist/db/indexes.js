import { connectToDatabase } from './db.js';
export async function createIndexes() {
    const db = await connectToDatabase();
    // Create indexes for ingredients collection
    await db.collection('ingredients').createIndexes([
        // Auto-complete index
        {
            key: { name: 1, source: 1 },
            name: 'name_source_idx'
        },
        // Search index
        {
            key: { name: 'text', description: 'text' },
            name: 'search_idx'
        },
        // Privacy filter index
        {
            key: { isPublic: 1, createdBy: 1 },
            name: 'privacy_idx'
        }
    ]);
    // Create indexes for scraped ingredients collection
    await db.collection('scraped_ingredients').createIndexes([
        // Price lookup index
        {
            key: { ingredientId: 1, validTo: 1 },
            name: 'price_lookup_idx'
        },
        // Store price index
        {
            key: { storeId: 1, validTo: 1 },
            name: 'store_price_idx'
        }
    ]);
    console.log('Database indexes created successfully');
}
//# sourceMappingURL=indexes.js.map