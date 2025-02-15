import { ObjectId } from 'mongodb';
export type ImportFormat = 'json' | 'csv' | 'markdown' | 'url' | 'image';
export type ExportFormat = 'json' | 'pdf' | 'markdown' | 'html';
export interface ImportOptions {
    userId: ObjectId;
    format: ImportFormat;
    source: string | File | Buffer;
    options?: {
        skipDuplicates?: boolean;
        mergeExisting?: boolean;
        detectLanguage?: boolean;
        parseIngredients?: boolean;
        parseInstructions?: boolean;
    };
}
export interface ExportOptions {
    format: ExportFormat;
    options?: {
        includeImages?: boolean;
        includeNutrition?: boolean;
        includeTags?: boolean;
        includeComments?: boolean;
        includeMetadata?: boolean;
        formatOptions?: {
            json?: {
                pretty?: boolean;
            };
            pdf?: {
                template?: 'simple' | 'detailed' | 'professional';
                paperSize?: 'A4' | 'letter' | 'legal';
                fontFamily?: string;
                fontSize?: number;
            };
            markdown?: {
                includeHeader?: boolean;
                includeFooter?: boolean;
                template?: string;
            };
            html?: {
                template?: string;
                style?: string;
            };
        };
    };
}
export interface ImportError {
    type: 'validation' | 'system' | 'format';
    message: string;
    details?: any;
}
export interface ImportWarning {
    type: string;
    message: string;
    details?: any;
}
export interface ImportResult {
    success: boolean;
    recipeIds: ObjectId[];
    errors?: ImportError[];
    warnings?: ImportWarning[];
    stats: {
        total: number;
        imported: number;
        skipped: number;
        failed: number;
        duplicates: number;
    };
}
export interface ExportError {
    type: 'system' | 'format';
    message: string;
    details?: any;
}
export interface ExportResult {
    success: boolean;
    data: string | Buffer;
    format: ExportFormat;
    metadata: {
        totalRecipes: number;
        generatedAt: Date;
        format: ExportFormat;
        version: string;
    };
    errors?: ExportError[];
}
export interface FormatFeatures {
    images: boolean;
    formatting: boolean;
    metadata: boolean;
    sections: boolean;
    links: boolean;
}
export interface FormatDefinition {
    name: string;
    extension: string;
    contentType: string;
    importSupported: boolean;
    exportSupported: boolean;
    features: FormatFeatures;
}
export interface ImportMapping {
    _id?: ObjectId;
    userId: ObjectId;
    name: string;
    description?: string;
    format: ImportFormat;
    fieldMappings: Record<string, {
        targetField: string;
        transform?: string;
        defaultValue?: any;
    }>;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}
