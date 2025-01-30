export function isRecipeSource(source) {
    return (typeof source === 'object' &&
        source !== null &&
        typeof source.name === 'string' &&
        (source.cuisine === undefined || typeof source.cuisine === 'string') &&
        ['easy', 'medium', 'hard'].includes(source.difficulty));
}
//# sourceMappingURL=search.js.map