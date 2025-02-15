export enum WebSocketMessageType {
  SHOPPING_LIST_UPDATE = 'SHOPPING_LIST_UPDATE',
  RECIPE_COLLABORATION = 'RECIPE_COLLABORATION',
  ERROR = 'ERROR'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  PREMIUM = 'PREMIUM'
}

export enum RecipeCategory {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACK = 'SNACK',
  DESSERT = 'DESSERT'
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum CuisineType {
  ITALIAN = 'ITALIAN',
  CHINESE = 'CHINESE',
  MEXICAN = 'MEXICAN',
  INDIAN = 'INDIAN',
  AMERICAN = 'AMERICAN',
  JAPANESE = 'JAPANESE',
  THAI = 'THAI',
  MEDITERRANEAN = 'MEDITERRANEAN',
  FRENCH = 'FRENCH',
  GREEK = 'GREEK'
}

export enum DietaryRestriction {
  VEGETARIAN = 'VEGETARIAN',
  VEGAN = 'VEGAN',
  GLUTEN_FREE = 'GLUTEN_FREE',
  DAIRY_FREE = 'DAIRY_FREE',
  NUT_FREE = 'NUT_FREE',
  KOSHER = 'KOSHER',
  HALAL = 'HALAL'
}

export enum MeasurementUnit {
  GRAM = 'g',
  KILOGRAM = 'kg',
  MILLILITER = 'ml',
  LITER = 'l',
  TEASPOON = 'tsp',
  TABLESPOON = 'tbsp',
  CUP = 'cup',
  PIECE = 'pc',
  OUNCE = 'oz',
  POUND = 'lb'
}

export enum NotificationType {
  RECIPE_COMMENT = 'RECIPE_COMMENT',
  RECIPE_LIKE = 'RECIPE_LIKE',
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  PRICE_ALERT = 'PRICE_ALERT',
  SHOPPING_LIST_SHARE = 'SHOPPING_LIST_SHARE'
}

export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_RECIPE_IMAGES = 5;
export const MAX_SHOPPING_LISTS = 10;
export const MAX_SAVED_RECIPES = 500;
export const PASSWORD_MIN_LENGTH = 8;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const RECIPE_TITLE_MAX_LENGTH = 100;
export const RECIPE_DESCRIPTION_MAX_LENGTH = 500;
export const SHOPPING_LIST_NAME_MAX_LENGTH = 50;
export const MAX_TAGS_PER_RECIPE = 10;
export const TAG_MAX_LENGTH = 30;
export const COMMENT_MAX_LENGTH = 1000;
export const MAX_INGREDIENTS_PER_RECIPE = 50;
export const MAX_STEPS_PER_RECIPE = 30;
export const STEP_DESCRIPTION_MAX_LENGTH = 500; 