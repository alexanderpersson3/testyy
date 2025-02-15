import type { LanguageCode } from '../types/index.js';
export interface DetectionResult {
    language: LanguageCode;
    confidence: number;
    isReliable: boolean;
}
export declare function detectLanguage(text: string): DetectionResult;
export declare function isLanguageSupported(language: string): language is LanguageCode;
