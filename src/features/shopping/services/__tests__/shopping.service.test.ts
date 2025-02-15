import { ObjectId } from 'mongodb';
import { ShoppingService } from '../shopping.service';
import { createTestUser, createTestShoppingList } from '../../../../__tests__/helpers';
import { ValidationError } from '../../../../core/errors/validation.error';
import { MongoNotFoundError } from '../../../../core/errors/mongodb.errors';

describe('ShoppingService', () => {
  const shoppingService = ShoppingService.getInstance();
  const testUser = createTestUser();

  describe('createShoppingList', () => {
    it('should create a shopping list successfully', async () => {
      const input = {
        name: 'My Shopping List',
        items: [
          {
            ingredientId: new ObjectId(),
            name: 'Test Ingredient',
            quantity: 1,
            unit: 'piece',
          },
        ],
      };

      const result = await shoppingService.createShoppingList(testUser._id, input);

      expect(result).toBeDefined();
      expect(result.name).toBe(input.name);
      expect(result.userId).toEqual(testUser._id);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe(input.items[0].name);
      expect(result.status).toBe('active');
    });

    it('should throw ValidationError if name is missing', async () => {
      const input = {
        items: [],
      };

      await expect(
        shoppingService.createShoppingList(testUser._id, input as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getShoppingList', () => {
    it('should get a shopping list by ID', async () => {
      const testList = createTestShoppingList({ userId: testUser._id });

      const result = await shoppingService.getShoppingList(testList._id, testUser._id);

      expect(result).toBeDefined();
      expect(result._id).toEqual(testList._id);
      expect(result.userId).toEqual(testUser._id);
    });

    it('should throw MongoNotFoundError if list does not exist', async () => {
      const nonExistentId = new ObjectId();

      await expect(
        shoppingService.getShoppingList(nonExistentId, testUser._id)
      ).rejects.toThrow(MongoNotFoundError);
    });

    it('should throw ValidationError if user does not have access', async () => {
      const otherUser = createTestUser();
      const testList = createTestShoppingList({ userId: otherUser._id });

      await expect(
        shoppingService.getShoppingList(testList._id, testUser._id)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateShoppingList', () => {
    it('should update a shopping list successfully', async () => {
      const testList = createTestShoppingList({ userId: testUser._id });
      const update = {
        name: 'Updated List Name',
        items: [
          {
            ingredientId: new ObjectId(),
            name: 'New Ingredient',
            quantity: 2,
            unit: 'pieces',
          },
        ],
      };

      const result = await shoppingService.updateShoppingList(
        testList._id,
        testUser._id,
        update
      );

      expect(result).toBeDefined();
      expect(result.name).toBe(update.name);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe(update.items[0].name);
    });

    it('should throw ValidationError if user is not the owner', async () => {
      const otherUser = createTestUser();
      const testList = createTestShoppingList({ userId: otherUser._id });
      const update = { name: 'Updated List Name' };

      await expect(
        shoppingService.updateShoppingList(testList._id, testUser._id, update)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteShoppingList', () => {
    it('should delete a shopping list successfully', async () => {
      const testList = createTestShoppingList({ userId: testUser._id });

      const result = await shoppingService.deleteShoppingList(testList._id, testUser._id);

      expect(result).toBe(true);
    });

    it('should throw ValidationError if user is not the owner', async () => {
      const otherUser = createTestUser();
      const testList = createTestShoppingList({ userId: otherUser._id });

      await expect(
        shoppingService.deleteShoppingList(testList._id, testUser._id)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('shareShoppingList', () => {
    it('should share a shopping list successfully', async () => {
      const testList = createTestShoppingList({ userId: testUser._id });
      const shareWithUser = createTestUser();

      const result = await shoppingService.shareShoppingList(
        testList._id,
        testUser._id,
        shareWithUser._id
      );

      expect(result).toBeDefined();
      expect(result.sharedWith).toContainEqual(shareWithUser._id);
    });

    it('should throw ValidationError if user is not the owner', async () => {
      const otherUser = createTestUser();
      const testList = createTestShoppingList({ userId: otherUser._id });
      const shareWithUser = createTestUser();

      await expect(
        shoppingService.shareShoppingList(testList._id, testUser._id, shareWithUser._id)
      ).rejects.toThrow(ValidationError);
    });
  });
}); 