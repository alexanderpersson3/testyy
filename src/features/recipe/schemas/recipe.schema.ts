import Joi from 'joi';
import { Difficulty } from '../types/recipe.types.js';

const ingredientSchema = Joi.object({
  name: Joi.string().required(),
  amount: Joi.number().required(),
  unit: Joi.string().required(),
  notes: Joi.string().optional(),
});

export const createRecipeSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  ingredients: Joi.array().items(ingredientSchema).min(1).required(),
  instructions: Joi.array().items(Joi.string()).min(1).required(),
  prepTime: Joi.number().min(0).required(),
  cookTime: Joi.number().min(0).required(),
  servings: Joi.number().min(1).required(),
  difficulty: Joi.string().valid(...Object.values(Difficulty)).required(),
  cuisine: Joi.string().required(),
  tags: Joi.array().items(Joi.string()).min(1).required(),
  isPublished: Joi.boolean().default(false),
  language: Joi.string().default('en'),
});

export const updateRecipeSchema = Joi.object({
  title: Joi.string(),
  description: Joi.string(),
  ingredients: Joi.array().items(ingredientSchema).min(1),
  instructions: Joi.array().items(Joi.string()).min(1),
  prepTime: Joi.number().min(0),
  cookTime: Joi.number().min(0),
  servings: Joi.number().min(1),
  difficulty: Joi.string().valid(...Object.values(Difficulty)),
  cuisine: Joi.string(),
  tags: Joi.array().items(Joi.string()).min(1),
  isPublished: Joi.boolean(),
  language: Joi.string(),
});

export const rateRecipeSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
});

export const getRecipesSchema = Joi.object({
  ids: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).required(),
});

export const findRecipeByTitleSchema = Joi.object({
  title: Joi.string().required(),
});

export const getRecipeLikesSchema = Joi.object({
  page: Joi.number().min(1),
  limit: Joi.number().min(1).max(50),
  includeUser: Joi.boolean(),
  excludeFields: Joi.string().pattern(/^[a-zA-Z_]+(,[a-zA-Z_]+)*$/),
});

export const reportRecipeSchema = Joi.object({
  reason: Joi.string().valid('inappropriate', 'copyright', 'spam', 'other').required(),
  description: Joi.string().when('reason', {
    is: 'other',
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
}); 