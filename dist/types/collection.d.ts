import { ObjectId } from 'mongodb';
export interface BaseCollection {
    userId: ObjectId;
    name: string;
    description?: string;
    imageUrl?: string;
    isPublic: boolean;
    recipeIds: ObjectId[];
    collaboratorIds: ObjectId[];
    followersCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface Collection extends BaseCollection {
    _id?: ObjectId;
}
export interface CollectionDocument extends BaseCollection {
    _id: ObjectId;
}
export interface CollectionWithDetails extends CollectionDocument {
    user?: {
        _id: ObjectId;
        username: string;
        avatar?: string;
    };
    recipes?: {
        _id: ObjectId;
        title: string;
        imageUrl?: string;
        description?: string;
        difficulty: string;
        prepTime: number;
        cookTime: number;
    }[];
    isFollowing?: boolean;
    isCollaborator?: boolean;
}
export interface CreateCollectionDTO {
    name: string;
    description?: string;
    imageUrl?: string;
    isPublic?: boolean;
    recipeIds?: string[];
    collaboratorIds?: string[];
}
export interface UpdateCollectionDTO {
    name?: string;
    description?: string;
    imageUrl?: string;
    isPublic?: boolean;
}
export interface CollectionQuery {
    userId?: string;
    isPublic?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    sort?: CollectionSortType;
}
export interface AddRecipeDTO {
    recipeId: string;
}
export interface AddCollaboratorDTO {
    userId: string;
}
export type CollectionSortType = 'newest' | 'oldest' | 'alphabetical' | 'popular';
