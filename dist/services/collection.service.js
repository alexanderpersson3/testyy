import { MongoClient } from 'mongodb';
import { connectToDatabase } from '../db.js';
export class CollectionService {
    /**
     * Create a new collection
     */
    async createCollection(collection) {
        const db = await connectToDatabase();
        const now = new Date();
        const newCollection = {
            ...collection,
            createdAt: now,
            updatedAt: now,
        };
        const result = await db.collection('collections').insertOne(newCollection);
        return { ...newCollection, _id: result.insertedId };
    }
    /**
     * Get a collection by ID
     */
    async getCollection(collectionId, userId) {
        const db = await connectToDatabase();
        return db.collection('collections').findOne({
            _id: collectionId,
            $or: [{ owner: userId }, { 'collaborators.userId': userId }, { isPublic: true }],
        });
    }
    /**
     * Update a collection
     */
    async updateCollection(collectionId, userId, updates) {
        const db = await connectToDatabase();
        const result = await db.collection('collections').updateOne({
            _id: collectionId,
            $or: [
                { owner: userId },
                {
                    'collaborators.userId': userId,
                    'collaborators.role': 'editor',
                },
            ],
        }, {
            $set: {
                ...updates,
                updatedAt: new Date(),
            },
        });
        return result.modifiedCount > 0;
    }
    /**
     * Delete a collection
     */
    async deleteCollection(collectionId, userId) {
        const db = await connectToDatabase();
        const result = await db.collection('collections').deleteOne({
            _id: collectionId,
            owner: userId,
        });
        return result.deletedCount > 0;
    }
    /**
     * Add a recipe to a collection
     */
    async addRecipe(collectionId, userId, recipeId, notes) {
        const db = await connectToDatabase();
        // Get the current highest order
        const collection = await this.getCollection(collectionId, userId);
        if (!collection)
            return false;
        const maxOrder = collection.recipes.reduce((max, recipe) => Math.max(max, recipe.order), -1);
        const result = await db.collection('collections').updateOne({
            _id: collectionId,
            $or: [
                { owner: userId },
                {
                    'collaborators.userId': userId,
                    'collaborators.role': 'editor',
                },
            ],
        }, {
            $push: {
                recipes: {
                    recipeId,
                    addedAt: new Date(),
                    notes,
                    order: maxOrder + 1,
                },
            },
            $set: { updatedAt: new Date() },
        });
        return result.modifiedCount > 0;
    }
    /**
     * Remove a recipe from a collection
     */
    async removeRecipe(collectionId, userId, recipeId) {
        const db = await connectToDatabase();
        const result = await db.collection('collections').updateOne({
            _id: collectionId,
            $or: [
                { owner: userId },
                {
                    'collaborators.userId': userId,
                    'collaborators.role': 'editor',
                },
            ],
        }, {
            $pull: { recipes: { recipeId } },
            $set: { updatedAt: new Date() },
        });
        return result.modifiedCount > 0;
    }
    /**
     * Update recipe notes
     */
    async updateRecipeNotes(collectionId, userId, recipeId, notes) {
        const db = await connectToDatabase();
        const result = await db.collection('collections').updateOne({
            _id: collectionId,
            'recipes.recipeId': recipeId,
            $or: [
                { owner: userId },
                {
                    'collaborators.userId': userId,
                    'collaborators.role': 'editor',
                },
            ],
        }, {
            $set: {
                'recipes.$.notes': notes,
                updatedAt: new Date(),
            },
        });
        return result.modifiedCount > 0;
    }
    /**
     * Reorder recipes in a collection
     */
    async reorderRecipes(collectionId, userId, recipeOrders) {
        const db = await connectToDatabase();
        // Update each recipe's order
        const bulkOps = recipeOrders.map(({ recipeId, order }) => ({
            updateOne: {
                filter: {
                    _id: collectionId,
                    'recipes.recipeId': recipeId,
                    $or: [
                        { owner: userId },
                        {
                            'collaborators.userId': userId,
                            'collaborators.role': 'editor',
                        },
                    ],
                },
                update: {
                    $set: {
                        'recipes.$.order': order,
                        updatedAt: new Date(),
                    },
                },
            },
        }));
        const result = await db.collection('collections').bulkWrite(bulkOps);
        return result.modifiedCount > 0;
    }
    /**
     * Add a collaborator to a collection
     */
    async addCollaborator(collectionId, userId, collaboratorId, role) {
        const db = await connectToDatabase();
        const result = await db.collection('collections').updateOne({
            _id: collectionId,
            owner: userId,
            'collaborators.userId': { $ne: collaboratorId },
        }, {
            $push: {
                collaborators: {
                    userId: collaboratorId,
                    role,
                },
            },
            $set: { updatedAt: new Date() },
        });
        return result.modifiedCount > 0;
    }
    /**
     * Remove a collaborator from a collection
     */
    async removeCollaborator(collectionId, userId, collaboratorId) {
        const db = await connectToDatabase();
        const result = await db.collection('collections').updateOne({
            _id: collectionId,
            owner: userId,
        }, {
            $pull: {
                collaborators: { userId: collaboratorId },
            },
            $set: { updatedAt: new Date() },
        });
        return result.modifiedCount > 0;
    }
    /**
     * Update collaborator role
     */
    async updateCollaboratorRole(collectionId, userId, collaboratorId, role) {
        const db = await connectToDatabase();
        const result = await db.collection('collections').updateOne({
            _id: collectionId,
            owner: userId,
            'collaborators.userId': collaboratorId,
        }, {
            $set: {
                'collaborators.$.role': role,
                updatedAt: new Date(),
            },
        });
        return result.modifiedCount > 0;
    }
    /**
     * Create a share link for a collection
     */
    async createShareLink(collectionId, userId) {
        const db = await connectToDatabase();
        const shareLink = `${process.env.APP_URL}/collections/${collectionId}/share/${new ObjectId().toHexString()}`;
        const result = await db.collection('collections').updateOne({
            _id: collectionId,
            owner: userId,
        }, {
            $set: {
                shareLink,
                updatedAt: new Date(),
            },
        });
        return result.modifiedCount > 0 ? shareLink : null;
    }
    /**
     * Create a collaborator invite
     */
    async createInvite(invite) {
        const db = await connectToDatabase();
        const now = new Date();
        const newInvite = {
            ...invite,
            status: 'pending',
            createdAt: now,
        };
        const result = await db
            .collection('collection_invites')
            .insertOne(newInvite);
        return { ...newInvite, _id: result.insertedId };
    }
    /**
     * Accept a collaborator invite
     */
    async acceptInvite(inviteId, userId) {
        const db = await connectToDatabase();
        const now = new Date();
        const invite = await db.collection('collection_invites').findOne({
            _id: inviteId,
            status: 'pending',
            expiresAt: { $gt: now },
        });
        if (!invite)
            return false;
        const client = await MongoClient.connect(process.env.MONGODB_URI);
        const session = client.startSession();
        try {
            await session.withTransaction(async () => {
                // Update invite status
                await db.collection('collection_invites').updateOne({ _id: inviteId }, {
                    $set: {
                        status: 'accepted',
                        acceptedAt: now,
                    },
                }, { session });
                // Add user as collaborator
                await db.collection('collections').updateOne({ _id: invite.collectionId }, {
                    $push: {
                        collaborators: {
                            userId,
                            role: invite.role,
                        },
                    },
                    $set: { updatedAt: now },
                }, { session });
            });
            return true;
        }
        catch (error) {
            return false;
        }
        finally {
            await session.endSession();
            await client.close();
        }
    }
    /**
     * Reject a collaborator invite
     */
    async rejectInvite(inviteId) {
        const db = await connectToDatabase();
        const result = await db.collection('collection_invites').updateOne({
            _id: inviteId,
            status: 'pending',
        }, {
            $set: {
                status: 'rejected',
            },
        });
        return result.modifiedCount > 0;
    }
}
//# sourceMappingURL=collection.service.js.map