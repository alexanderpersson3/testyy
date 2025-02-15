import { ObjectId } from 'mongodb';
export type CollectionEventType = 'collection_created' | 'collection_updated' | 'recipe_added' | 'recipe_removed' | 'collaborator_added' | 'collaborator_removed' | 'collaborator_updated' | 'collection_shared' | 'collection_unshared';
export interface CollectionActivity {
    _id?: ObjectId;
    collectionId: ObjectId;
    userId: ObjectId;
    type: CollectionEventType;
    details: {
        name?: string;
        description?: string;
        recipeId?: ObjectId;
        recipeTitle?: string;
        collaboratorId?: ObjectId;
        collaboratorEmail?: string;
        role?: 'viewer' | 'editor';
        changes?: Array<{
            field: string;
            oldValue: any;
            newValue: any;
        }>;
    };
    createdAt: Date;
}
export declare function logCollectionActivity(collectionId: ObjectId, userId: ObjectId, type: CollectionEventType, details: CollectionActivity['details']): Promise<void>;
export declare function getCollectionActivities(collectionId: ObjectId, options?: {
    limit?: number;
    before?: Date;
    type?: CollectionEventType[];
}): Promise<CollectionActivity[]>;
export declare function getCollectionActivityService(): {
    logCollectionActivity: typeof logCollectionActivity;
    getCollectionActivities: typeof getCollectionActivities;
};
