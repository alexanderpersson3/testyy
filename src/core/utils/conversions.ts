import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { ShoppingList, ShoppingListItem, ShoppingListCollaborator } from '../types/express.js';
import type { RecipeIngredient } from '../types/express.js';
import type { UserProfile } from '../types/express.js';

/**
 * Converts a raw MongoDB shopping list document to a ShoppingList type
 */
export function convertToShoppingList(raw: any): ShoppingList {
  const now = new Date();
  return {
    _id: raw._id instanceof ObjectId ? raw._id : new ObjectId(raw._id),
    name: raw.name,
    owner: raw.owner instanceof ObjectId ? raw.owner : new ObjectId(raw.owner),
    collaborators: Array.isArray(raw.collaborators)
      ? raw.collaborators.map(convertToShoppingListCollaborator).filter(Boolean) as ShoppingListCollaborator[]
      : [],
    items: Array.isArray(raw.items) ? raw.items.map(convertToShoppingListItem) : [],
    createdAt: raw.createdAt ? new Date(raw.createdAt) : now,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : now
  };
}

/**
 * Converts a raw MongoDB shopping list item to a ShoppingListItem type
 */
export function convertToShoppingListItem(raw: any): ShoppingListItem {
  return {
    ingredient: raw.ingredient?.name || raw.name || '',
    amount: typeof raw.quantity === 'number' ? raw.quantity : 1,
    unit: raw.unit || '',
    checked: Boolean(raw.checked)
  };
}

/**
 * Converts a raw MongoDB shopping list collaborator to a ShoppingListCollaborator type
 */
export function convertToShoppingListCollaborator(raw: any): ShoppingListCollaborator | undefined {
  if (!raw) return undefined;
  return {
    userId: raw.userId instanceof ObjectId ? raw.userId : new ObjectId(raw.userId),
    role: raw.role || 'viewer'
  };
}

/**
 * Converts a raw MongoDB recipe ingredient to a RecipeIngredient type
 */
export function convertToRecipeIngredient(raw: any): RecipeIngredient {
  return {
    name: raw.name || '',
    amount: typeof raw.amount === 'number' ? raw.amount : (raw.quantity || 1),
    unit: raw.unit || '',
    notes: raw.notes
  };
}

/**
 * Converts a raw MongoDB user profile document to a UserProfile type
 */
export function convertToUserProfile(raw: any): UserProfile {
  const now = new Date();
  return {
    _id: raw._id instanceof ObjectId ? raw._id : new ObjectId(raw._id),
    email: raw.email || '',
    username: raw.username || '',
    name: raw.name || '',
    avatar: raw.avatar,
    preferences: {
      language: raw.preferences?.language || 'en',
      theme: raw.preferences?.theme || 'light',
      notifications: Boolean(raw.preferences?.notifications)
    },
    createdAt: raw.createdAt ? new Date(raw.createdAt) : now,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : now
  };
}
