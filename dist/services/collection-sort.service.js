import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
export class CollectionSortService {
    /**
     * Sort collection recipes
     */
    async sortCollectionRecipes(collectionId, sortConfig) {
        const db = await connectToDatabase();
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
        });
        if (!collection) {
            throw new Error('Collection not found');
        }
        // Get full recipe details
        const recipeIds = collection.recipes.map(r => r.recipeId);
        const recipes = await db
            .collection('recipes')
            .find({ _id: { $in: recipeIds } })
            .toArray();
        // Create a map for quick recipe lookup
        const recipeMap = new Map(recipes.map(r => [r._id.toString(), r]));
        // Sort recipes
        collection.recipes.sort((a, b) => {
            const recipeA = recipeMap.get(a.recipeId.toString());
            const recipeB = recipeMap.get(b.recipeId.toString());
            if (!recipeA || !recipeB)
                return 0;
            const comparison = this.compareRecipes(recipeA, recipeB, sortConfig);
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
        // Update positions
        collection.recipes.forEach((recipe, index) => {
            recipe.position = index;
        });
        // Save sorted collection
        await db.collection('collections').updateOne({ _id: new ObjectId(collectionId) }, {
            $set: {
                recipes: collection.recipes,
                'settings.sortBy': sortConfig.field,
                'settings.sortDirection': sortConfig.direction,
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Filter collection recipes
     */
    async filterCollectionRecipes(collectionId, filterConfig) {
        const db = await connectToDatabase();
        const collection = await db.collection('collections').findOne({
            _id: new ObjectId(collectionId),
        });
        if (!collection) {
            throw new Error('Collection not found');
        }
        // Get full recipe details
        const recipeIds = collection.recipes.map(r => r.recipeId);
        const recipes = await db
            .collection('recipes')
            .find({ _id: { $in: recipeIds } })
            .toArray();
        // Apply filters
        const filteredRecipes = recipes.filter(recipe => {
            // Tag filter
            if (filterConfig.tags?.length) {
                if (!filterConfig.tags.every(tag => recipe.tags?.includes(tag))) {
                    return false;
                }
            }
            // Rating filter
            if (filterConfig.rating) {
                const rating = recipe.rating || 0;
                if (filterConfig.rating.min !== undefined && rating < filterConfig.rating.min) {
                    return false;
                }
                if (filterConfig.rating.max !== undefined && rating > filterConfig.rating.max) {
                    return false;
                }
            }
            // Difficulty filter
            if (filterConfig.difficulty?.length) {
                if (!filterConfig.difficulty.includes(recipe.difficulty)) {
                    return false;
                }
            }
            // Cooking time filter
            if (filterConfig.cookingTime) {
                const time = recipe.totalTime || 0;
                if (filterConfig.cookingTime.min !== undefined && time < filterConfig.cookingTime.min) {
                    return false;
                }
                if (filterConfig.cookingTime.max !== undefined && time > filterConfig.cookingTime.max) {
                    return false;
                }
            }
            // Ingredient filter
            if (filterConfig.ingredients) {
                const recipeIngredients = recipe.ingredients.map(ingredient => ingredient.name.toLowerCase());
                // Required ingredients
                if (filterConfig.ingredients.include?.length) {
                    if (!filterConfig.ingredients.include.every(ing => recipeIngredients.some(recipeIng => recipeIng.includes(ing.toLowerCase())))) {
                        return false;
                    }
                }
                // Excluded ingredients
                if (filterConfig.ingredients.exclude?.length) {
                    if (filterConfig.ingredients.exclude.some(ing => recipeIngredients.some(recipeIng => recipeIng.includes(ing.toLowerCase())))) {
                        return false;
                    }
                }
            }
            // Cuisine filter
            if (filterConfig.cuisine?.length) {
                if (!filterConfig.cuisine.includes(recipe.cuisine || '')) {
                    return false;
                }
            }
            // Dietary filter
            if (filterConfig.dietary?.length) {
                if (!filterConfig.dietary.every(diet => recipe.dietary?.includes(diet))) {
                    return false;
                }
            }
            // Text search
            if (filterConfig.searchText) {
                const searchTerms = filterConfig.searchText.toLowerCase().split(/\s+/);
                const searchableText = [
                    recipe.title,
                    recipe.description || '',
                    ...recipe.ingredients.map(ingredient => ingredient.name),
                    ...recipe.instructions.map(instruction => instruction.text),
                ]
                    .join(' ')
                    .toLowerCase();
                if (!searchTerms.every(term => searchableText.includes(term))) {
                    return false;
                }
            }
            return true;
        });
        // Update collection with filtered recipes
        const filteredCollection = {
            ...collection,
            recipes: collection.recipes.filter(r => filteredRecipes.some(fr => fr._id.toString() === r.recipeId.toString())),
        };
        return filteredCollection;
    }
    /**
     * Compare recipes for sorting
     */
    compareRecipes(recipeA, recipeB, config) {
        switch (config.field) {
            case 'name':
                return recipeA.title.localeCompare(recipeB.title);
            case 'rating':
                return (recipeA.rating || 0) - (recipeB.rating || 0);
            case 'difficulty': {
                const difficultyOrder = {
                    easy: 0,
                    medium: 1,
                    hard: 2,
                };
                return difficultyOrder[recipeA.difficulty] - difficultyOrder[recipeB.difficulty];
            }
            case 'cookingTime':
                return recipeA.totalTime - recipeB.totalTime;
            case 'created':
                return recipeA.createdAt.getTime() - recipeB.createdAt.getTime();
            case 'updated':
                return recipeA.updatedAt.getTime() - recipeB.updatedAt.getTime();
            case 'popularity':
                return (recipeA.viewCount || 0) - (recipeB.viewCount || 0);
            default:
                return 0;
        }
    }
}
//# sourceMappingURL=collection-sort.service.js.map