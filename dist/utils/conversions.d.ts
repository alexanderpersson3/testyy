import type { ShoppingList, ShoppingListItem, ShoppingListCollaborator } from '../types/index.js';
import type { RecipeIngredient } from '../types/index.js';
import type { UserProfile } from '../types/index.js';
/**
 * Converts a raw MongoDB shopping list document to a ShoppingList type
 */
export declare function convertToShoppingList(raw: any): ShoppingList;
/**
 * Converts a raw MongoDB shopping list item to a ShoppingListItem type
 */
export declare function convertToShoppingListItem(raw: any): ShoppingListItem;
/**
 * Converts a raw MongoDB shopping list collaborator to a ShoppingListCollaborator type
 */
export declare function convertToShoppingListCollaborator(raw: any): ShoppingListCollaborator | undefined;
/**
 * Converts a raw MongoDB recipe ingredient to a RecipeIngredient type
 */
export declare function convertToRecipeIngredient(raw: any): RecipeIngredient;
/**
 * Converts a raw MongoDB user profile document to a UserProfile type
 */
export declare function convertToUserProfile(raw: any): UserProfile;
