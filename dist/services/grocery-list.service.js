import { connectToDatabase } from '../db.js';
export class GroceryListService {
    /**
     * Create a new grocery list
     */
    async createList(userId, name, collectionId) {
        const db = await connectToDatabase();
        const list = {
            userId: new ObjectId(userId),
            name,
            items: [],
            ...(collectionId && { collectionId: new ObjectId(collectionId) }),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('grocery_lists').insertOne(list);
        return result.insertedId;
    }
    /**
     * Add items to grocery list
     */
    async addItems(listId, items, userId) {
        const db = await connectToDatabase();
        const now = new Date();
        const groceryItems = items.map(item => ({
            ...item,
            userId: new ObjectId(userId),
            checked: false,
            createdAt: now,
            updatedAt: now,
        }));
        await db.collection('grocery_lists').updateOne({ _id: new ObjectId(listId) }, {
            $push: { items: { $each: groceryItems } },
            $set: { updatedAt: now },
        });
    }
    /**
     * Add recipe ingredients to grocery list
     */
    async addRecipeIngredients(listId, recipeId, userId) {
        const db = await connectToDatabase();
        const recipe = await db.collection('recipes').findOne({ _id: new ObjectId(recipeId) });
        if (!recipe) {
            throw new Error('Recipe not found');
        }
        const ingredients = recipe.ingredients.map((ingredient) => ({
            name: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
            category: ingredient.category,
            recipeId: new ObjectId(recipeId),
            checked: false,
        }));
        await this.addItems(listId, ingredients, userId);
    }
    /**
     * Add collection recipe ingredients to grocery list
     */
    async addCollectionIngredients(listId, collectionId, userId) {
        const db = await connectToDatabase();
        const collection = await db
            .collection('collections')
            .findOne({ _id: new ObjectId(collectionId) });
        if (!collection) {
            throw new Error('Collection not found');
        }
        for (const recipe of collection.recipes) {
            await this.addRecipeIngredients(listId, recipe.recipeId.toString(), userId);
        }
    }
    /**
     * Update item status
     */
    async updateItemStatus(listId, itemId, checked) {
        const db = await connectToDatabase();
        await db.collection('grocery_lists').updateOne({
            _id: new ObjectId(listId),
            'items._id': new ObjectId(itemId),
        }, {
            $set: {
                'items.$.checked': checked,
                'items.$.updatedAt': new Date(),
            },
        });
    }
    /**
     * Remove item from list
     */
    async removeItem(listId, itemId) {
        const db = await connectToDatabase();
        await db.collection('grocery_lists').updateOne({ _id: new ObjectId(listId) }, {
            $pull: { items: { _id: new ObjectId(itemId) } },
            $set: { updatedAt: new Date() },
        });
    }
    /**
     * Clear completed items
     */
    async clearCompleted(listId) {
        const db = await connectToDatabase();
        await db.collection('grocery_lists').updateOne({ _id: new ObjectId(listId) }, {
            $pull: { items: { checked: true } },
            $set: { updatedAt: new Date() },
        });
    }
    /**
     * Delete list
     */
    async deleteList(listId, userId) {
        const db = await connectToDatabase();
        await db.collection('grocery_lists').deleteOne({
            _id: new ObjectId(listId),
            userId: new ObjectId(userId),
        });
    }
    /**
     * Get user's grocery lists
     */
    async getUserLists(userId) {
        const db = await connectToDatabase();
        return await db
            .collection('grocery_lists')
            .find({ userId: new ObjectId(userId) })
            .sort({ updatedAt: -1 })
            .toArray();
    }
    /**
     * Get list by ID
     */
    async getList(listId, userId) {
        const db = await connectToDatabase();
        return await db.collection('grocery_lists').findOne({
            _id: new ObjectId(listId),
            userId: new ObjectId(userId),
        });
    }
}
//# sourceMappingURL=grocery-list.service.js.map