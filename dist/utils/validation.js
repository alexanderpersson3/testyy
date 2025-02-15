export function validateRecipe(recipe) {
    const errors = [];
    if (!recipe.title?.trim()) {
        errors.push({ field: 'title', message: 'Title is required' });
    }
    if (!recipe.ingredients?.length) {
        errors.push({ field: 'ingredients', message: 'At least one ingredient is required' });
    }
    else {
        recipe.ingredients.forEach((ingredient, index) => {
            if (!ingredient.name?.trim()) {
                errors.push({ field: `ingredients[${index}].name`, message: 'Ingredient name is required' });
            }
            if (typeof ingredient.amount !== 'number' || ingredient.amount <= 0) {
                errors.push({ field: `ingredients[${index}].amount`, message: 'Valid ingredient amount is required' });
            }
            if (!ingredient.unit?.trim()) {
                errors.push({ field: `ingredients[${index}].unit`, message: 'Ingredient unit is required' });
            }
        });
    }
    if (!recipe.instructions?.length) {
        errors.push({ field: 'instructions', message: 'At least one instruction is required' });
    }
    else {
        recipe.instructions.forEach((instruction, index) => {
            if (!instruction.text?.trim()) {
                errors.push({ field: `instructions[${index}].text`, message: 'Instruction text is required' });
            }
            if (typeof instruction.step !== 'number' || instruction.step <= 0) {
                errors.push({ field: `instructions[${index}].step`, message: 'Valid instruction step number is required' });
            }
        });
    }
    return errors;
}
export function validateRecipeStrict(recipe) {
    const errors = validateRecipe(recipe);
    if (!recipe.description?.trim()) {
        errors.push({ field: 'description', message: 'Description is required' });
    }
    if (typeof recipe.servings !== 'number' || recipe.servings < 1) {
        errors.push({ field: 'servings', message: 'Valid number of servings is required' });
    }
    if (typeof recipe.prepTime !== 'number' || recipe.prepTime < 0) {
        errors.push({ field: 'prepTime', message: 'Valid preparation time is required' });
    }
    if (typeof recipe.cookTime !== 'number' || recipe.cookTime < 0) {
        errors.push({ field: 'cookTime', message: 'Valid cooking time is required' });
    }
    if (!recipe.difficulty || !['easy', 'medium', 'hard'].includes(recipe.difficulty)) {
        errors.push({ field: 'difficulty', message: 'Valid difficulty level is required' });
    }
    if (!recipe.tags?.length) {
        errors.push({ field: 'tags', message: 'At least one tag is required' });
    }
    if (!recipe.images?.length) {
        errors.push({ field: 'images', message: 'At least one image is required' });
    }
    return errors;
}
//# sourceMappingURL=validation.js.map