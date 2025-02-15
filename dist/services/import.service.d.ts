import type { ObjectId } from '../types/index.js';
import { ImportJob, ImportOptions, ImportFormat, ImportMapping } from '../types/export.js';
export interface ImportServiceInterface {
    createImportJob(userId: ObjectId, format: ImportFormat, options: ImportOptions, fileKey: string): Promise<ImportJob>;
    getImportJob(jobId: ObjectId): Promise<ImportJob | null>;
    saveMapping(userId: ObjectId, mapping: Omit<ImportMapping, '_id' | 'createdAt' | 'updatedAt'>): Promise<ImportMapping>;
    getMapping(mappingId: ObjectId): Promise<ImportMapping | null>;
    getMappings(userId: ObjectId): Promise<ImportMapping[]>;
    deleteMapping(mappingId: ObjectId, userId: ObjectId): Promise<boolean>;
}
export declare class ImportService implements ImportServiceInterface {
    private static instance;
    private initialized;
    private db;
    private importJobsCollection;
    private importMappingsCollection;
    private storageService;
    private recipeService;
    private notificationService;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): ImportService;
    private validateImportOptions;
    createImportJob(userId: ObjectId, format: ImportFormat, options: ImportOptions, fileKey: string): Promise<ImportJob>;
    getImportJob(jobId: ObjectId): Promise<ImportJob | null>;
    private processImportJob;
    private parseRecipes;
    private detectFileFormat;
    private splitRecipes;
    saveMapping(userId: ObjectId, mapping: Omit<ImportMapping, '_id' | 'createdAt' | 'updatedAt'>): Promise<ImportMapping>;
    getMapping(mappingId: ObjectId): Promise<ImportMapping | null>;
    getMappings(userId: ObjectId): Promise<ImportMapping[]>;
    deleteMapping(mappingId: ObjectId, userId: ObjectId): Promise<boolean>;
}
