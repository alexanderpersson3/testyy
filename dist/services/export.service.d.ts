import type { ObjectId } from '../types/index.js';
import type { ExportOptions } from '../types/index.js';
import { ExportJob, ExportFormat, ExportTemplate } from '../types/export.js';
export interface ExportServiceInterface {
    createExportJob(userId: ObjectId, format: ExportFormat, options: ExportOptions, recipeIds: ObjectId[], collectionIds?: ObjectId[]): Promise<ExportJob>;
    getExportJob(jobId: ObjectId): Promise<ExportJob | null>;
    saveTemplate(userId: ObjectId, template: Omit<ExportTemplate, '_id' | 'createdAt' | 'updatedAt'>): Promise<ExportTemplate>;
    getTemplate(templateId: ObjectId): Promise<ExportTemplate | null>;
    getTemplates(userId: ObjectId): Promise<ExportTemplate[]>;
    deleteTemplate(templateId: ObjectId, userId: ObjectId): Promise<boolean>;
}
export declare class ExportService implements ExportServiceInterface {
    private static instance;
    private initialized;
    private db;
    private exportJobsCollection;
    private exportTemplatesCollection;
    private readonly storageService;
    private readonly recipeService;
    private readonly collectionService;
    private readonly notificationService;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): ExportService;
    private validateExportOptions;
    createExportJob(userId: ObjectId, format: ExportFormat, options: ExportOptions, recipeIds: ObjectId[], collectionIds?: ObjectId[]): Promise<ExportJob>;
    getExportJob(jobId: ObjectId): Promise<ExportJob | null>;
    private processExportJob;
    private getRecipesForExport;
    private generateExport;
    private generatePdfExport;
    private generateJsonExport;
    private generateCsvExport;
    saveTemplate(userId: ObjectId, template: Omit<ExportTemplate, '_id' | 'createdAt' | 'updatedAt'>): Promise<ExportTemplate>;
    getTemplate(templateId: ObjectId): Promise<ExportTemplate | null>;
    getTemplates(userId: ObjectId): Promise<ExportTemplate[]>;
    deleteTemplate(templateId: ObjectId, userId: ObjectId): Promise<boolean>;
}
