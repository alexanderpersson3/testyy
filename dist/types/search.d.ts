import { Recipe } from './recipe.js';
export interface RecipeSearchResponse {
    hits: {
        total: number;
        hits: Array<{
            _id: string;
            _score: number;
            _source: Recipe;
        }>;
    };
}
export interface RecipeSuggestion {
    name: string;
    cuisine?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    score: number;
}
export declare function isRecipeSource(source: any): source is Pick<Recipe, 'name' | 'cuisine' | 'difficulty'>;
//# sourceMappingURL=search.d.ts.map