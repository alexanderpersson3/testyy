export interface Collection {
    _id?: ObjectId;
    name: string;
    description?: string;
    coverImage?: string;
    owner: ObjectId;
    collaborators: Array<{
        userId: ObjectId;
        role: 'editor' | 'viewer';
    }>;
    recipes: Array<{
        recipeId: ObjectId;
        addedAt: Date;
        notes?: string;
        order: number;
    }>;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
    shareLink?: string;
}
export interface CollaboratorInvite {
    _id?: ObjectId;
    collectionId: ObjectId;
    invitedBy: ObjectId;
    email: string;
    role: 'editor' | 'viewer';
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
    expiresAt: Date;
    acceptedAt?: Date;
}
export declare class CollectionService {
    /**
     * Create a new collection
     */
    createCollection(collection: Omit<Collection, '_id' | 'createdAt' | 'updatedAt'>): Promise<Collection>;
    /**
     * Get a collection by ID
     */
    getCollection(collectionId: ObjectId, userId: ObjectId): Promise<Collection | null>;
    /**
     * Update a collection
     */
    updateCollection(collectionId: ObjectId, userId: ObjectId, updates: Partial<Collection>): Promise<boolean>;
    /**
     * Delete a collection
     */
    deleteCollection(collectionId: ObjectId, userId: ObjectId): Promise<boolean>;
    /**
     * Add a recipe to a collection
     */
    addRecipe(collectionId: ObjectId, userId: ObjectId, recipeId: ObjectId, notes?: string): Promise<boolean>;
    /**
     * Remove a recipe from a collection
     */
    removeRecipe(collectionId: ObjectId, userId: ObjectId, recipeId: ObjectId): Promise<boolean>;
    /**
     * Update recipe notes
     */
    updateRecipeNotes(collectionId: ObjectId, userId: ObjectId, recipeId: ObjectId, notes: string): Promise<boolean>;
    /**
     * Reorder recipes in a collection
     */
    reorderRecipes(collectionId: ObjectId, userId: ObjectId, recipeOrders: Array<{
        recipeId: ObjectId;
        order: number;
    }>): Promise<boolean>;
    /**
     * Add a collaborator to a collection
     */
    addCollaborator(collectionId: ObjectId, userId: ObjectId, collaboratorId: ObjectId, role: 'editor' | 'viewer'): Promise<boolean>;
    /**
     * Remove a collaborator from a collection
     */
    removeCollaborator(collectionId: ObjectId, userId: ObjectId, collaboratorId: ObjectId): Promise<boolean>;
    /**
     * Update collaborator role
     */
    updateCollaboratorRole(collectionId: ObjectId, userId: ObjectId, collaboratorId: ObjectId, role: 'editor' | 'viewer'): Promise<boolean>;
    /**
     * Create a share link for a collection
     */
    createShareLink(collectionId: ObjectId, userId: ObjectId): Promise<string | null>;
    /**
     * Create a collaborator invite
     */
    createInvite(invite: Omit<CollaboratorInvite, '_id' | 'status' | 'createdAt' | 'acceptedAt'>): Promise<CollaboratorInvite>;
    /**
     * Accept a collaborator invite
     */
    acceptInvite(inviteId: ObjectId, userId: ObjectId): Promise<boolean>;
    /**
     * Reject a collaborator invite
     */
    rejectInvite(inviteId: ObjectId): Promise<boolean>;
}
