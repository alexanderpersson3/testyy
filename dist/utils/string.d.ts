/**
 * Calculate the Levenshtein distance between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns The Levenshtein distance
 */
export declare function levenshteinDistance(str1: string, str2: string): number;
/**
 * Calculate string similarity using Levenshtein distance
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score between 0 and 1
 */
export declare function stringSimilarity(str1: string, str2: string): number;
/**
 * Normalize a string for comparison
 * @param str String to normalize
 * @returns Normalized string
 */
export declare function normalizeString(str: string): string;
/**
 * Get common prefix length between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Length of common prefix
 */
export declare function commonPrefixLength(str1: string, str2: string): number;
/**
 * Check if a string contains another string, ignoring case and diacritics
 * @param haystack String to search in
 * @param needle String to search for
 * @returns Whether the needle was found
 */
export declare function containsNormalized(haystack: string, needle: string): boolean;
/**
 * Split a string into words, handling multiple delimiters
 * @param str String to split
 * @returns Array of words
 */
export declare function splitWords(str: string): string[];
export declare function slugify(str: string): string;
