const defaultOptions = {
    stripHtml: true,
    normalizeText: true,
    maxLength: {
        title: 200,
        description: 2000,
        instruction: 1000,
    },
};
export function sanitizeRecipe(recipe, options = {}) {
    const opts = { ...defaultOptions, ...options };
    return {
        ...recipe,
        title: sanitizeText(recipe.title, opts.maxLength?.title),
        description: sanitizeText(recipe.description, opts.maxLength?.description),
        ingredients: recipe.ingredients.map(ingredient => ({
            ...ingredient,
            name: sanitizeText(ingredient.name),
            notes: ingredient.notes ? sanitizeText(ingredient.notes) : undefined,
        })),
        instructions: recipe.instructions.map(instruction => ({
            ...instruction,
            text: sanitizeText(instruction.text, opts.maxLength?.instruction),
        })),
    };
}
function sanitizeText(text, maxLength) {
    if (!text)
        return '';
    let sanitized = text;
    // Strip HTML if enabled
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    // Truncate if maxLength is specified
    if (maxLength && sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength).trim();
    }
    return sanitized;
}
//# sourceMappingURL=recipe-sanitizer.js.map