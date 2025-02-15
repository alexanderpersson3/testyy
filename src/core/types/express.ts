import type { Request as BaseRequest, Response as BaseResponse, NextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import type { ObjectId } from 'mongodb';

export interface AuthenticatedUser {
  _id: ObjectId;
  role: string;
}

export interface AppRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
> extends Omit<BaseRequest<P, ResBody, ReqBody, ReqQuery>, 'user'> {
  user?: AuthenticatedUser;
}

export interface AppResponse<ResBody = any> extends BaseResponse<ResBody> {}

export type AppRequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
> = (
  req: AppRequest<P, ResBody, ReqBody, ReqQuery>,
  res: AppResponse<ResBody>,
  next: NextFunction
) => void | Promise<void>;

export interface ValidateRequest {
  (schema: {
    body?: any;
    query?: any;
    params?: any;
  }): AppRequestHandler;
}

// Export type aliases for convenience
export type { NextFunction };
export type Request<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> = AppRequest<P, ResBody, ReqBody, ReqQuery>;
export type Response<ResBody = any> = AppResponse<ResBody>;
export type RequestHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> = AppRequestHandler<P, ResBody, ReqBody, ReqQuery>;

// Re-export express types with better type safety
export type Request<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = Omit<Request<P, ResBody, ReqBody, ReqQuery>, 'body'> & {
  body: ReqBody;
};

export type Response<ResBody = any> = Response<ResBody>;
export type NextFunction = NextFunction;

// Base authenticated request type
export interface AuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user: {
    _id: ObjectId;
    email: string;
    username: string;
    role: string;
  };
}

// Route parameter base type
export type RouteParams = {
  [K in string]: string;
} & ParamsDictionary;

// Handler types with proper typing
export type RequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => void | Promise<void> | Promise<Response<ResBody>>;

export type AuthenticatedRequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = (
  req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => void | Promise<void> | Promise<Response<ResBody>>;

// Middleware types
export type Middleware<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = RequestHandler<P, ResBody, ReqBody, ReqQuery>;

export type AuthenticatedMiddleware<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = AuthenticatedRequestHandler<P, ResBody, ReqBody, ReqQuery>;

// Helper types for request bodies and responses
export interface TypedRequestBody<T> extends Request {
  body: T;
}

export interface TypedRequestQuery<T extends ParsedQs> extends Request {
  query: T;
}

export interface TypedRequestParams<T extends RouteParams> extends Request {
  params: T;
}

// Validation middleware types
export type ValidationMiddleware<T> = Middleware<ParamsDictionary, any, T>;
export type AuthenticatedValidationMiddleware<T> = AuthenticatedMiddleware<ParamsDictionary, any, T>;

// Export commonly used type combinations
export type AsyncHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> = 
  RequestHandler<P, ResBody, ReqBody, ReqQuery>;

export type AsyncAuthenticatedHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> = 
  AuthenticatedRequestHandler<P, ResBody, ReqBody, ReqQuery>;

// Base types
export interface BaseDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// User types
export interface UserDocument extends BaseDocument {
  _id: ObjectId;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  role: 'user' | 'admin';
  preferences: UserPreferences;
}

// Recipe types
export interface Recipe extends BaseDocument {
  title: string;
  description: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  servings: number;
  prepTime: number;
  cookTime: number;
  totalTime?: number;
  difficulty: Difficulty;
  cuisine: string;
  tags: string[];
  images: string[];
  author: UserDocument;
  language: string;
  availableLanguages: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  notes?: string;
}

export interface RecipeInstruction {
  step: number;
  text: string;
  timer?: number;
}

export const Difficulty = {
  Easy: 'easy',
  Medium: 'medium',
  Hard: 'hard'
} as const;

export type Difficulty = typeof Difficulty[keyof typeof Difficulty];

// Shopping list types
export interface ShoppingList extends BaseDocument {
  name: string;
  items: ShoppingListItem[];
  owner: ObjectId;
  collaborators: ShoppingListCollaborator[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingListItem {
  ingredient: string;
  amount: number;
  unit: string;
  checked: boolean;
}

export interface ShoppingListCollaborator {
  userId: ObjectId;
  role: 'editor' | 'viewer';
}

// User types
export interface UserProfile extends BaseDocument {
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark';
  notifications: boolean;
}

// Collection types
export interface Collection extends BaseDocument {
  name: string;
  description?: string;
  recipes: ObjectId[];
  owner: ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Timer types
export interface Timer {
  duration: number;
  unit: TimerUnit;
  alerts: TimerAlert[];
}

export type TimerUnit = 'minutes' | 'hours';

export interface TimerAlert {
  time: number;
  type: 'notification' | 'sound';
  message?: string;
}

// Unit conversion types
export interface UnitDefinition {
  name: string;
  symbol: string;
  category: UnitCategory;
  baseConversion: number;
}

export type UnitCategory = 'volume' | 'weight' | 'length' | 'temperature';

export interface UnitConversion {
  from: string;
  to: string;
  factor: number;
}

// Export types
export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf';
  includeImages: boolean;
  includeTags: boolean;
} 