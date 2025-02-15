import { ObjectId } from 'mongodb';
;
/**
 * Converts a raw MongoDB shopping list document to a ShoppingList type
 */
export function convertToShoppingList(raw) {
    return {
        _id: raw._id instanceof ObjectId ? raw._id : new ObjectId(raw._id),
        userId: raw.userId instanceof ObjectId ? raw.userId.toString() : String(raw.userId),
        name: raw.name,
        description: raw.description,
        owner: raw.owner instanceof ObjectId ? raw.owner.toString() : String(raw.owner),
        collaborators: Array.isArray(raw.collaborators)
            ? raw.collaborators.map(convertToShoppingListCollaborator)
            : [],
        items: Array.isArray(raw.items) ? raw.items.map(convertToShoppingListItem) : [],
        store: raw.store
            ? {
                _id: raw.store._id instanceof ObjectId ? raw.store._id : new ObjectId(raw.store._id),
                name: raw.store.name,
            }
            : undefined,
        status: raw.status || 'active',
        totalEstimatedPrice: raw.totalEstimatedPrice || {
            amount: 0,
            currency: 'USD'
        },
        recipeIds: Array.isArray(raw.recipeIds)
            ? raw.recipeIds.map((id) => (id instanceof ObjectId ? id : new ObjectId(id)))
            : [],
        servingsMultiplier: raw.servingsMultiplier || {},
        completedAt: raw.completedAt ? new Date(raw.completedAt) : undefined,
        completedBy: raw.completedBy
            ? raw.completedBy instanceof ObjectId
                ? raw.completedBy
                : new ObjectId(raw.completedBy)
            : undefined,
        createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date()
    };
}
/**
 * Converts a raw MongoDB shopping list item to a ShoppingListItem type
 */
export function convertToShoppingListItem(raw) {
    return {
        id: raw._id ? (raw._id instanceof ObjectId ? raw._id.toString() : raw._id) : new ObjectId().toString(),
        name: raw.ingredient?.name || raw.name || '',
        quantity: typeof raw.quantity === 'number' ? raw.quantity : 1,
        unit: raw.unit || '',
        checked: Boolean(raw.checked),
        category: raw.category,
        notes: raw.notes,
        addedBy: {
            id: raw.addedBy?.id || raw.addedBy?._id?.toString() || '',
            name: raw.addedBy?.name || 'Unknown',
        },
        createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    };
}
/**
 * Converts a raw MongoDB shopping list collaborator to a ShoppingListCollaborator type
 */
export function convertToShoppingListCollaborator(raw) {
    if (!raw)
        return undefined;
    return {
        userId: raw.userId instanceof ObjectId ? raw.userId : new ObjectId(raw.userId),
        role: raw.role || 'viewer',
        joinedAt: raw.joinedAt ? new Date(raw.joinedAt) : new Date(),
    };
}
/**
 * Converts a raw MongoDB recipe ingredient to a RecipeIngredient type
 */
export function convertToRecipeIngredient(raw) {
    return {
        name: raw.name || '',
        amount: typeof raw.amount === 'number' ? raw.amount : (raw.quantity || 1),
        unit: raw.unit || '',
        notes: raw.notes,
        ingredientId: raw.ingredientId instanceof ObjectId ? raw.ingredientId : (raw.ingredientId ? new ObjectId(raw.ingredientId) : undefined),
        estimatedCost: raw.estimatedCost ? {
            amount: raw.estimatedCost.amount || 0,
            currency: raw.estimatedCost.currency || 'USD',
            lastUpdated: raw.estimatedCost.lastUpdated ? new Date(raw.estimatedCost.lastUpdated) : new Date()
        } : undefined
    };
}
/**
 * Converts a raw MongoDB user profile document to a UserProfile type
 */
export function convertToUserProfile(raw) {
    return {
        _id: raw._id instanceof ObjectId ? raw._id : new ObjectId(raw._id),
        email: raw.email || '',
        name: raw.name || '',
        role: raw.role || 'user',
        bio: raw.bio,
        location: raw.location,
        website: raw.website,
        socialLinks: raw.socialLinks || {},
        preferences: {
            dietary: Array.isArray(raw.preferences?.dietary) ? raw.preferences.dietary : [],
            cuisine: Array.isArray(raw.preferences?.cuisine) ? raw.preferences.cuisine : [],
            notifications: {
                email: Boolean(raw.preferences?.notifications?.email),
                push: Boolean(raw.preferences?.notifications?.push),
                inApp: Boolean(raw.preferences?.notifications?.inApp)
            },
            privacy: {
                profileVisibility: raw.preferences?.privacy?.profileVisibility || 'public',
                recipeVisibility: raw.preferences?.privacy?.recipeVisibility || 'public',
                activityVisibility: raw.preferences?.privacy?.activityVisibility || 'public'
            }
        },
        stats: {
            recipesCreated: raw.stats?.recipesCreated || 0,
            recipesLiked: raw.stats?.recipesLiked || 0,
            followers: raw.stats?.followers || 0,
            following: raw.stats?.following || 0,
            totalViews: raw.stats?.totalViews || 0
        },
        following: Array.isArray(raw.following)
            ? raw.following.map((id) => id instanceof ObjectId ? id : new ObjectId(id))
            : [],
        followers: Array.isArray(raw.followers)
            ? raw.followers.map((id) => id instanceof ObjectId ? id : new ObjectId(id))
            : [],
        lastActive: raw.lastActive ? new Date(raw.lastActive) : undefined,
        accountStatus: raw.accountStatus || 'active',
        createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date()
    };
}
//# sourceMappingURL=conversions.js.map