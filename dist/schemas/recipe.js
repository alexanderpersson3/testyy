import { z } from 'zod';
export const ingredientSchema = z.object({
    name: z.string().min(1).max(100),
    amount: z.number().min(0).optional(),
    unit: z.string().max(20).optional(),
    notes: z.string().max(200).optional(),
});
export const instructionSchema = z.object({
    text: z.string().min(1).max(1000),
    time: z.number().min(0).optional(),
    temperature: z.number().min(0).optional(),
    notes: z.string().max(200).optional(),
});
export const nutritionSchema = z.object({
    calories: z.number().min(0).optional(),
    protein: z.number().min(0).optional(),
    carbs: z.number().min(0).optional(),
    fat: z.number().min(0).optional(),
    fiber: z.number().min(0).optional(),
    sugar: z.number().min(0).optional(),
    sodium: z.number().min(0).optional(),
});
export const parseRecipeSchema = z.object({
    userId: z.any(), // Will be converted to ObjectId
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    prepTime: z.number().min(0),
    cookTime: z.number().min(0),
    totalTime: z.number().min(0).optional(),
    servings: z.number().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    cuisine: z.string().max(50).optional(),
    course: z.string().max(50).optional(),
    ingredients: z.array(ingredientSchema),
    instructions: z.array(instructionSchema),
    nutrition: nutritionSchema.optional(),
    tags: z.array(z.string().max(50)).optional(),
    images: z.array(z.string().url()).optional(),
    source: z.string().url().optional(),
    notes: z.string().max(1000).optional(),
    isPublic: z.boolean().default(true),
    createdAt: z.date(),
    updatedAt: z.date(),
});
//# sourceMappingURL=recipe.js.map