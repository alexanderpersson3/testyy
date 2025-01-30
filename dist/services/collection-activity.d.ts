import { ObjectId } from 'mongodb';
export interface CollectionActivity {
    _id: ObjectId;
    collectionId: ObjectId;
    userId: ObjectId;
    type: 'collection_created' | 'collection_updated' | 'recipe_added' | 'recipe_removed' | 'collaborator_added' | 'collaborator_removed' | 'collaborator_updated' | 'collection_shared' | 'collection_unshared';
    details: {
        name?: string;
        description?: string;
        recipeId?: ObjectId;
        recipeTitle?: string;
        collaboratorId?: ObjectId;
        collaboratorEmail?: string;
        role?: 'viewer' | 'editor';
        changes?: {
            field: string;
            oldValue: any;
            newValue: any;
        }[];
    };
    createdAt: Date;
}
export declare function logCollectionActivity(collectionId: ObjectId, userId: ObjectId, type: CollectionActivity['type'], details: CollectionActivity['details']): Promise<void>;
export declare function getCollectionActivities(collectionId: ObjectId, options?: {
    limit?: number;
    before?: Date;
    type?: CollectionActivity['type'][];
}): Promise<import("bson").Document[]>;
export declare function getCollectionActivityService(): {
    logCollectionActivity: typeof logCollectionActivity;
    getCollectionActivities: typeof getCollectionActivities;
};
//# sourceMappingURL=collection-activity.d.ts.map