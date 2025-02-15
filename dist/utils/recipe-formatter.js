/**
 * Format a recipe for export
 */
export function formatRecipeForExport(recipe, options) {
    const formatted = {
        title: recipe.title,
        description: recipe.description,
        servings: recipe.servings ?? 1,
        prepTime: recipe.prepTime ?? 0,
        cookTime: recipe.cookTime ?? 0,
        totalTime: recipe.totalTime ?? ((recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)),
        difficulty: recipe.difficulty,
        ingredients: recipe.ingredients.map(ingredient => ({
            name: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
        })),
        instructions: recipe.instructions.map((instruction, index) => ({
            step: index + 1,
            text: instruction.text,
            ...(instruction.duration !== undefined && { duration: instruction.duration }),
            ...(instruction.temperature && { temperature: instruction.temperature }),
        })),
    };
    if (options.includeTags && recipe.tags?.length > 0) {
        formatted.tags = recipe.tags;
    }
    if (options.includeImages && recipe.images?.length > 0) {
        formatted.imageUrl = recipe.images[0];
    }
    return formatted;
}
export function formatRecipe(recipe) {
    return {
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient) => ({
            ...ingredient,
            name: (ingredient.name ?? '').trim(),
            amount: Number(ingredient.amount ?? 0),
            unit: (ingredient.unit ?? '').trim()
        })),
        instructions: recipe.instructions.map((instruction, index) => ({
            ...instruction,
            text: (instruction.text ?? '').trim(),
            step: index + 1
        }))
    };
}
//# sourceMappingURL=recipe-formatter.js.map