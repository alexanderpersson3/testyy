import type { RecipeCollection, CollectionRecipe, CollectionCollaborator, CollectionFilters, CreateCollectionRequest, UpdateCollectionRequest, AddRecipeRequest, UpdateRecipeRequest, AddCollaboratorRequest, CollectionShareResult, CollectionExportOptions, CollectionImportResult, CollectionAnalytics } from '../types/index.js';
export declare class CollectionsService {
    private readonly defaultSettings;
    private db;
    constructor();
    /**
     * Create a new collection
     */
    createCollection(userId: string, request: CreateCollectionRequest): Promise<RecipeCollection>;
    /**
     * Update a collection
     */
    updateCollection(userId: string, collectionId: string, updates: UpdateCollectionRequest): Promise<RecipeCollection>;
    /**
     * Delete a collection
     */
    deleteCollection(userId: string, collectionId: string): Promise<void>;
    /**
     * Get collections
     */
    getCollections(userId: string, filters?: CollectionFilters): Promise<RecipeCollection[]>;
    /**
     * Add recipe to collection
     */
    addRecipe(userId: string, collectionId: string, request: AddRecipeRequest): Promise<CollectionRecipe>;
    /**
     * Update recipe in collection
     */
    updateRecipe(userId: string, collectionId: string, recipeId: string, updates: UpdateRecipeRequest): Promise<CollectionRecipe>;
    /**
     * Remove recipe from collection
     */
    removeRecipe(userId: string, collectionId: string, recipeId: string): Promise<void>;
    /**
     * Add collaborator to collection
     */
    addCollaborator(userId: string, collectionId: string, request: AddCollaboratorRequest): Promise<CollectionCollaborator>;
    /**
     * Remove collaborator from collection
     */
    removeCollaborator(userId: string, collectionId: string, collaboratorId: string): Promise<void>;
    /**
     * Share collection
     */
    shareCollection(userId: string, collectionId: string, expiresIn?: number): Promise<CollectionShareResult>;
    /**
     * Export collection
     */
    exportCollection(userId: string, collectionId: string, options: CollectionExportOptions): Promise<Buffer>;
    /**
     * Import collection
     */
    importCollection(userId: string, file: Buffer, format: string): Promise<CollectionImportResult>;
    /**
     * Get collection analytics
     */
    getAnalytics(userId: string, collectionId: string): Promise<CollectionAnalytics>;
    /**
     * Helper: Verify collection access
     */
    private verifyCollectionAccess;
    /**
     * Helper: Generate exports
     */
    private generateJsonExport;
    private generatePdfExport;
    private generateCsvExport;
    private generateMarkdownExport;
    /**
     * Helper: Parse imports
     */
    private parseImportFile;
}
