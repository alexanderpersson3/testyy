import { ImportFormat } from '../types/export.js';
export interface FormatDetectionResult {
    format?: ImportFormat;
    confidence: number;
    possibleFormats: Array<{
        format: ImportFormat;
        confidence: number;
    }>;
    metadata?: {
        version?: string;
        generator?: string;
        timestamp?: Date;
    };
}
export declare function detectFormat(content: string): FormatDetectionResult;
