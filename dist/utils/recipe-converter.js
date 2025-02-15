import { ObjectId } from 'mongodb';
;
export function convertToRecipe(parsed) {
    return {
        title: parsed.title,
        description: parsed.description,
        ingredients: parsed.ingredients,
        instructions: parsed.instructions,
        servings: parsed.servings || 4,
        prepTime: parsed.prepTime || 0,
        cookTime: parsed.cookTime || 0,
        totalTime: parsed.totalTime || (parsed.prepTime || 0) + (parsed.cookTime || 0),
        difficulty: parsed.difficulty || 'medium',
        cuisine: parsed.cuisine,
        tags: parsed.tags || [],
        images: [],
        author: {
            _id: new ObjectId(),
            name: 'System Parser',
        },
        ratings: {
            average: 0,
            count: 0,
        },
        language: 'en',
        availableLanguages: ['en'],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
//# sourceMappingURL=recipe-converter.js.map