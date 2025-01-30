type CollectionEventType = 'collection_updated' | 'recipe_added' | 'recipe_removed' | 'collaborator_added' | 'collaborator_removed' | 'collaborator_updated' | 'collection_created' | 'collection_shared' | 'collection_unshared';
interface CollectionNotification {
    type: CollectionEventType;
    collectionId: string;
    data: any;
}
export declare function initializeCollectionWebSocket(server: any): void;
export declare function notifyCollectionUpdate(notification: CollectionNotification): void;
export declare function getCollectionWebSocketService(): {
    notifyCollectionUpdate: typeof notifyCollectionUpdate;
};
export {};
//# sourceMappingURL=collection-websocket.d.ts.map