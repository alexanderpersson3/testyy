import { testRequest, generateTestToken, authHeader } from './setup';
import { userFixtures } from '../fixtures/users.fixture';
import { shoppingListFixtures } from '../fixtures/shopping-lists.fixture';
import { databaseService } from '../../core/database/database.service';

describe('Shopping API', () => {
  const db = databaseService.getDb();
  const shoppingListsCollection = db.collection('shopping_lists');
  const usersCollection = db.collection('users');

  beforeEach(async () => {
    await shoppingListsCollection.deleteMany({});
    await usersCollection.deleteMany({});
    await usersCollection.insertOne(userFixtures.regularUser);
  });

  describe('GET /api/shopping/lists', () => {
    beforeEach(async () => {
      await shoppingListsCollection.insertOne(shoppingListFixtures.defaultList);
      await shoppingListsCollection.insertOne(shoppingListFixtures.sharedList);
    });

    it('should return user\'s shopping lists', async () => {
      const token = generateTestToken();

      const response = await testRequest
        .get('/api/shopping/lists')
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.lists).toHaveLength(2);
      expect(response.body.lists[0]).toMatchObject({
        name: shoppingListFixtures.defaultList.name
      });
    });

    it('should include shared lists', async () => {
      const token = generateTestToken(userFixtures.premiumUser._id.toString());

      const response = await testRequest
        .get('/api/shopping/lists')
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.lists).toHaveLength(1);
      expect(response.body.lists[0]).toMatchObject({
        name: shoppingListFixtures.sharedList.name
      });
    });
  });

  describe('POST /api/shopping/lists', () => {
    it('should create a new shopping list', async () => {
      const token = generateTestToken();
      const newList = {
        name: 'New Shopping List',
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            unit: 'piece'
          }
        ]
      };

      const response = await testRequest
        .post('/api/shopping/lists')
        .set(authHeader(token))
        .send(newList);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: newList.name,
        items: expect.arrayContaining([
          expect.objectContaining({
            name: newList.items[0].name
          })
        ])
      });
    });

    it('should return 401 when not authenticated', async () => {
      const newList = {
        name: 'New Shopping List',
        items: []
      };

      const response = await testRequest
        .post('/api/shopping/lists')
        .send(newList);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/shopping/lists/:id', () => {
    beforeEach(async () => {
      await shoppingListsCollection.insertOne(shoppingListFixtures.defaultList);
    });

    it('should update a shopping list', async () => {
      const token = generateTestToken();
      const update = {
        name: 'Updated List Name',
        items: [
          {
            name: 'New Item',
            quantity: 2,
            unit: 'pieces'
          }
        ]
      };

      const response = await testRequest
        .put(`/api/shopping/lists/${shoppingListFixtures.defaultList._id}`)
        .set(authHeader(token))
        .send(update);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: update.name,
        items: expect.arrayContaining([
          expect.objectContaining({
            name: update.items[0].name
          })
        ])
      });
    });

    it('should return 403 when not the owner or shared user', async () => {
      const token = generateTestToken(userFixtures.adminUser._id.toString());
      const update = { name: 'Updated List Name' };

      const response = await testRequest
        .put(`/api/shopping/lists/${shoppingListFixtures.defaultList._id}`)
        .set(authHeader(token))
        .send(update);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/shopping/lists/:id/share', () => {
    beforeEach(async () => {
      await shoppingListsCollection.insertOne(shoppingListFixtures.defaultList);
      await usersCollection.insertOne(userFixtures.premiumUser);
    });

    it('should share a list with another user', async () => {
      const token = generateTestToken();
      const shareWith = {
        userId: userFixtures.premiumUser._id.toString()
      };

      const response = await testRequest
        .post(`/api/shopping/lists/${shoppingListFixtures.defaultList._id}/share`)
        .set(authHeader(token))
        .send(shareWith);

      expect(response.status).toBe(200);
      expect(response.body.sharedWith).toContain(shareWith.userId);
    });

    it('should return 403 when not the owner', async () => {
      const token = generateTestToken(userFixtures.premiumUser._id.toString());
      const shareWith = {
        userId: userFixtures.adminUser._id.toString()
      };

      const response = await testRequest
        .post(`/api/shopping/lists/${shoppingListFixtures.defaultList._id}/share`)
        .set(authHeader(token))
        .send(shareWith);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/shopping/lists/:id', () => {
    beforeEach(async () => {
      await shoppingListsCollection.insertOne(shoppingListFixtures.defaultList);
    });

    it('should delete a shopping list', async () => {
      const token = generateTestToken();

      const response = await testRequest
        .delete(`/api/shopping/lists/${shoppingListFixtures.defaultList._id}`)
        .set(authHeader(token));

      expect(response.status).toBe(204);

      const deletedList = await shoppingListsCollection.findOne({
        _id: shoppingListFixtures.defaultList._id
      });
      expect(deletedList).toBeNull();
    });

    it('should return 403 when not the owner', async () => {
      const token = generateTestToken(userFixtures.adminUser._id.toString());

      const response = await testRequest
        .delete(`/api/shopping/lists/${shoppingListFixtures.defaultList._id}`)
        .set(authHeader(token));

      expect(response.status).toBe(403);
    });
  });
}); 