import { ObjectId } from 'mongodb';
import request from 'supertest';
import express, { Express } from 'express';
import userRecipesRouter from '../user-recipes';
import savedRecipeManager from '../../services/saved-recipe-manager';
import mealPlanManager from '../../services/meal-plan-manager';
import imageManager from '../../services/image-manager';
import { Server } from 'http';

// Mock dependencies
jest.mock('../../services/saved-recipe-manager');
jest.mock('../../services/meal-plan-manager');
jest.mock('../../services/image-manager');
jest.mock('multer', () => {
  return jest.fn().mockImplementation(() => ({
    array: jest.fn().mockImplementation(() => (req: any, res: any, next: any) => {
      req.files = [
        {
          buffer: Buffer.from('test'),
          originalname: 'test.jpg',
          mimetype: 'image/jpeg',
        },
      ];
      next();
    }),
  }));
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      _id: req.headers['x-user-id'] || new ObjectId().toString(),
      role: req.headers['x-user-role'] || 'user',
    };
    next();
  },
}));

jest.mock('../../middleware/rate-limit', () => ({
  rateLimiter: (req: any, res: any, next: any) => next(),
}));

jest.mock('../../middleware/validation', () => ({
  validateRequest: () => (req: any, res: any, next: any) => next(),
}));

describe('User Recipes Router', () => {
  let app: Express;
  let server: Server;
  const mockUserId = new ObjectId().toString();
  const mockRecipeId = new ObjectId().toString();
  const mockDate = new Date('2024-01-01');

  beforeAll(done => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
    app = express();
    app.use(express.json());
    app.use('/user-recipes', userRecipesRouter);
    server = app.listen(() => {
      done();
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(done => {
    jest.useRealTimers();
    if (server && server.listening) {
      server.close(() => {
        server.unref();
        done();
      });
    } else {
      done();
    }
  });

  describe('Saved Recipes', () => {
    test('should save a recipe', async () => {
      const mockSavedRecipe = {
        _id: new ObjectId(),
        title: 'Test Recipe',
        description: 'Test Description',
        addedAt: mockDate,
      };

      (savedRecipeManager.saveRecipe as jest.Mock).mockResolvedValueOnce(mockSavedRecipe);

      const response = await request(app)
        .post(`/user-recipes/saved-recipes/${mockRecipeId}`)
        .set('x-user-id', mockUserId);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockSavedRecipe,
          _id: mockSavedRecipe._id.toString(),
          addedAt: mockDate.toISOString(),
        },
      });
      expect(savedRecipeManager.saveRecipe).toHaveBeenCalledWith(mockUserId, mockRecipeId);
    });

    test('should get saved recipes', async () => {
      const mockSavedRecipes = [
        {
          _id: new ObjectId(),
          title: 'Test Recipe 1',
          description: 'Test Description 1',
          addedAt: mockDate,
        },
      ];

      (savedRecipeManager.getSavedRecipes as jest.Mock).mockResolvedValueOnce(mockSavedRecipes);

      const response = await request(app)
        .get('/user-recipes/saved-recipes')
        .set('x-user-id', mockUserId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockSavedRecipes.map(recipe => ({
          ...recipe,
          _id: recipe._id.toString(),
          addedAt: mockDate.toISOString(),
        })),
      });
      expect(savedRecipeManager.getSavedRecipes).toHaveBeenCalledWith(mockUserId);
    });

    test('should remove a saved recipe', async () => {
      (savedRecipeManager.unsaveRecipe as jest.Mock).mockResolvedValueOnce(true);

      const response = await request(app)
        .delete(`/user-recipes/saved-recipes/${mockRecipeId}`)
        .set('x-user-id', mockUserId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Recipe removed from saved recipes',
      });
      expect(savedRecipeManager.unsaveRecipe).toHaveBeenCalledWith(mockUserId, mockRecipeId);
    });
  });

  describe('Meal Plans', () => {
    const mockMealPlanData = {
      title: 'Test Meal Plan',
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-07T00:00:00.000Z',
      recipes: [
        {
          recipeId: mockRecipeId,
          servings: 4,
          dayOfWeek: 1,
          mealType: 'dinner' as const,
          notes: 'Test notes',
        },
      ],
    };

    test('should create a meal plan', async () => {
      const mockMealPlan = {
        _id: new ObjectId(),
        userId: new ObjectId(mockUserId),
        ...mockMealPlanData,
        recipes: mockMealPlanData.recipes.map(recipe => ({
          ...recipe,
          recipeId: new ObjectId(recipe.recipeId),
        })),
        createdAt: mockDate,
        updatedAt: mockDate,
      };

      (mealPlanManager.createMealPlan as jest.Mock).mockResolvedValueOnce(mockMealPlan);

      const response = await request(app)
        .post('/user-recipes/meal-plans')
        .set('x-user-id', mockUserId)
        .send(mockMealPlanData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockMealPlan,
          _id: mockMealPlan._id.toString(),
          userId: mockMealPlan.userId.toString(),
          recipes: mockMealPlan.recipes.map(recipe => ({
            ...recipe,
            recipeId: recipe.recipeId.toString(),
          })),
          createdAt: mockDate.toISOString(),
          updatedAt: mockDate.toISOString(),
        },
      });
    });

    test('should get meal plans', async () => {
      const mockMealPlans = [
        {
          _id: new ObjectId(),
          userId: new ObjectId(mockUserId),
          title: 'Test Meal Plan',
          startDate: mockDate,
          endDate: new Date('2024-01-07'),
          recipes: [
            {
              recipeId: new ObjectId(mockRecipeId),
              servings: 4,
              dayOfWeek: 1,
              mealType: 'dinner',
              notes: 'Test notes',
            },
          ],
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ];

      (mealPlanManager.getMealPlans as jest.Mock).mockResolvedValueOnce(mockMealPlans);

      const response = await request(app)
        .get('/user-recipes/meal-plans')
        .set('x-user-id', mockUserId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockMealPlans.map(plan => ({
          ...plan,
          _id: plan._id.toString(),
          userId: plan.userId.toString(),
          recipes: plan.recipes.map(recipe => ({
            ...recipe,
            recipeId: recipe.recipeId.toString(),
          })),
          startDate: mockDate.toISOString(),
          endDate: new Date('2024-01-07').toISOString(),
          createdAt: mockDate.toISOString(),
          updatedAt: mockDate.toISOString(),
        })),
      });
    });

    test('should update a meal plan', async () => {
      const mockUpdatedMealPlan = {
        _id: new ObjectId(),
        userId: new ObjectId(mockUserId),
        ...mockMealPlanData,
        recipes: mockMealPlanData.recipes.map(recipe => ({
          ...recipe,
          recipeId: new ObjectId(recipe.recipeId),
        })),
        createdAt: mockDate,
        updatedAt: mockDate,
      };

      (mealPlanManager.updateMealPlan as jest.Mock).mockResolvedValueOnce(mockUpdatedMealPlan);

      const response = await request(app)
        .put(`/user-recipes/meal-plans/${mockUpdatedMealPlan._id}`)
        .set('x-user-id', mockUserId)
        .send(mockMealPlanData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockUpdatedMealPlan,
          _id: mockUpdatedMealPlan._id.toString(),
          userId: mockUpdatedMealPlan.userId.toString(),
          recipes: mockUpdatedMealPlan.recipes.map(recipe => ({
            ...recipe,
            recipeId: recipe.recipeId.toString(),
          })),
          createdAt: mockDate.toISOString(),
          updatedAt: mockDate.toISOString(),
        },
      });
    });

    test('should delete a meal plan', async () => {
      (mealPlanManager.deleteMealPlan as jest.Mock).mockResolvedValueOnce(true);

      const response = await request(app)
        .delete(`/user-recipes/meal-plans/${mockRecipeId}`)
        .set('x-user-id', mockUserId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Meal plan deleted successfully',
      });
    });
  });

  describe('Recipe Images', () => {
    test('should upload recipe images', async () => {
      const mockImages = [
        {
          _id: new ObjectId(),
          recipeId: new ObjectId(mockRecipeId),
          variants: {
            original: {
              url: 'https://example.com/original.jpg',
              width: 1920,
              height: 1080,
              size: 1024000,
            },
            large: {
              url: 'https://example.com/large.jpg',
              width: 1200,
              height: 800,
              size: 512000,
            },
            thumbnail: {
              url: 'https://example.com/thumbnail.jpg',
              width: 300,
              height: 200,
              size: 128000,
            },
          },
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ];

      (imageManager.uploadRecipeImages as jest.Mock).mockResolvedValueOnce(mockImages);

      // Skip the actual file upload in the test
      const response = await request(app)
        .post(`/user-recipes/recipes/${mockRecipeId}/images`)
        .set('x-user-id', mockUserId)
        .send();

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: mockImages.map(image => ({
          ...image,
          _id: image._id.toString(),
          recipeId: image.recipeId.toString(),
          createdAt: mockDate.toISOString(),
          updatedAt: mockDate.toISOString(),
        })),
      });
      expect(imageManager.uploadRecipeImages).toHaveBeenCalledWith(
        mockRecipeId,
        expect.arrayContaining([expect.any(Buffer)])
      );
    });

    test('should delete recipe images', async () => {
      const imageIds = [new ObjectId().toString()];
      (imageManager.deleteRecipeImages as jest.Mock).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete(`/user-recipes/recipes/${mockRecipeId}/images`)
        .set('x-user-id', mockUserId)
        .send({ imageIds });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Images deleted successfully',
      });
      expect(imageManager.deleteRecipeImages).toHaveBeenCalledWith(mockRecipeId, imageIds);
    });
  });
}); 