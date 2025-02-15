/**
 * Calculate the Levenshtein distance between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns The Levenshtein distance
 */
export function levenshteinDistance(str1, str2) {
    // Handle edge cases
    if (!str1.length)
        return str2.length;
    if (!str2.length)
        return str1.length;
    // Initialize the matrix
    const matrix = Array(str1.length + 1).fill(null).map(() => Array(str2.length + 1).fill(0));
    // Fill in the first row and column
    for (let i = 0; i <= str1.length; i++) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
        matrix[0][j] = j;
    }
    // Fill in the rest of the matrix
    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + 1 // substitution
                );
            }
        }
    }
    return matrix[str1.length][str2.length];
}
/**
 * Calculate string similarity using Levenshtein distance
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score between 0 and 1
 */
export function stringSimilarity(str1, str2) {
    if (str1 === str2)
        return 1;
    if (str1.length === 0 || str2.length === 0)
        return 0;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const longerLength = longer.length;
    if (longerLength === 0)
        return 1;
    const editDistance = levenshteinDistance(longer, shorter);
    return (longerLength - editDistance) / longerLength;
}
/**
 * Normalize a string for comparison
 * @param str String to normalize
 * @returns Normalized string
 */
export function normalizeString(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}
/**
 * Get common prefix length between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Length of common prefix
 */
export function commonPrefixLength(str1, str2) {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
        i++;
    }
    return i;
}
/**
 * Check if a string contains another string, ignoring case and diacritics
 * @param haystack String to search in
 * @param needle String to search for
 * @returns Whether the needle was found
 */
export function containsNormalized(haystack, needle) {
    const normalizedHaystack = normalizeString(haystack);
    const normalizedNeedle = normalizeString(needle);
    return normalizedHaystack.includes(normalizedNeedle);
}
/**
 * Split a string into words, handling multiple delimiters
 * @param str String to split
 * @returns Array of words
 */
export function splitWords(str) {
    return str.split(/[\s,.-]+/).filter(word => word.length > 0);
}
export function slugify(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}
//# sourceMappingURL=string.js.map