import { EmbedOptions } from '../types/sharing.js';
/**
 * Generate HTML embed code for a recipe
 */
export declare function generateEmbedCode(url: string, options?: EmbedOptions): string;
/**
 * Generate CSS for embedded recipe widget
 */
export declare function generateEmbedStyles(theme?: 'light' | 'dark'): string;
