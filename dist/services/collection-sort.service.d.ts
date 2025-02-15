import type { RecipeCollection, CollectionSortOption } from '../types/index.js';
export interface SortConfig {
    field: CollectionSortOption;
    direction: 'asc' | 'desc';
    subSort?: SortConfig;
}
export interface FilterConfig {
    tags?: string[];
    rating?: {
        min?: number;
        max?: number;
    };
    difficulty?: Array<'easy' | 'medium' | 'hard'>;
    cookingTime?: {
        min?: number;
        max?: number;
    };
    ingredients?: {
        include?: string[];
        exclude?: string[];
    };
    cuisine?: string[];
    dietary?: string[];
    searchText?: string;
}
export declare class CollectionSortService {
    /**
     * Sort collection recipes
     */
    sortCollectionRecipes(collectionId: string, sortConfig: SortConfig): Promise<void>;
    /**
     * Filter collection recipes
     */
    filterCollectionRecipes(collectionId: string, filterConfig: FilterConfig): Promise<RecipeCollection>;
    /**
     * Compare recipes for sorting
     */
    private compareRecipes;
}
