import Joi from 'joi';
import { isValidObjectId } from '../../../shared/utils/validation.utils.js';

const objectIdSchema = Joi.string().custom((value, helpers) => {
  if (!isValidObjectId(value)) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'ObjectId validation');

export const createCommentSchema = Joi.object({
  targetId: objectIdSchema.required(),
  targetType: Joi.string().valid('recipe', 'user', 'article').required(),
  content: Joi.string().min(1).max(1000).required(),
  parentId: objectIdSchema
});

export const updateCommentSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required()
});

export const toggleLikeSchema = Joi.object({
  targetType: Joi.string().valid('recipe', 'comment', 'article').required()
});

export const createShareSchema = Joi.object({
  targetId: objectIdSchema.required(),
  targetType: Joi.string().valid('recipe', 'article').required(),
  platform: Joi.string().valid('facebook', 'twitter', 'pinterest', 'email').required(),
  metadata: Joi.object({
    url: Joi.string().uri().required(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    image: Joi.string().uri()
  })
});

export const getCommentsByTargetSchema = Joi.object({
  targetType: Joi.string().valid('recipe', 'user', 'article').required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
}); 