import request from 'supertest';
import { MongoClient, ObjectId } from 'mongodb';
import app from '../index.js';

describe('Price Integration', () => {
  let connection;
  let db;
  let testUserId;
  let testToken;
  let testIngredientId;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGODB_URI);
    db = connection.db(process.env.MONGODB_DB);
    testUserId = await createTestUser();
    testToken = generateTestToken(testUserId);

    // Create a test ingredient
    const result = await db.collection('ingredient').insertOne({
      name: 'Test Ingredient',
      newPrice: 10.99,
      oldPrice: 12.99,
      store: 'Test Store',
      image: 'test-image.jpg',
      storeLogo: 'test-store-logo.jpg',
      createdAt: new Date(),
    });
    testIngredientId = result.insertedId;
  });

  afterAll(async () => {
    await connection.close();
  });

  describe('Price History', () => {
    beforeEach(async () => {
      // Clear price history before each test
      await db.collection('priceHistory').deleteMany({});
    });

    it('should get price history for an ingredient', async () => {
      // Add some price history records
      const now = new Date();
      await db.collection('priceHistory').insertMany([
        {
          ingredientId: testIngredientId,
          price: 10.99,
          store: 'Test Store',
          timestamp: new Date(now - 2000),
        },
        {
          ingredientId: testIngredientId,
          price: 11.99,
          store: 'Test Store',
          timestamp: new Date(now - 1000),
        },
      ]);

      const response = await request(app).get(
        `/api/prices/ingredients/${testIngredientId}/history`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('price');
      expect(response.body.data[0]).toHaveProperty('store');
      expect(response.body.data[0]).toHaveProperty('timestamp');
    });

    it('should return empty array for ingredient with no history', async () => {
      const response = await request(app).get(`/api/prices/ingredients/${new ObjectId()}/history`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('Price Alerts', () => {
    beforeEach(async () => {
      // Clear price alerts before each test
      await db.collection('priceAlerts').deleteMany({});
    });

    it('should create a price alert successfully', async () => {
      const alertData = {
        ingredientId: testIngredientId.toString(),
        targetPrice: 9.99,
        type: 'below',
      };

      const response = await request(app)
        .post('/api/prices/alerts')
        .set('Authorization', `Bearer ${testToken}`)
        .send(alertData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('targetPrice', 9.99);
      expect(response.body.data).toHaveProperty('type', 'below');
      expect(response.body.data).toHaveProperty('triggered', false);

      // Verify alert in database
      const alert = await db.collection('priceAlerts').findOne({
        ingredientId: testIngredientId,
        userId: testUserId,
      });
      expect(alert).not.toBeNull();
      expect(alert.targetPrice).toBe(9.99);
    });

    it('should validate alert data', async () => {
      const invalidData = {
        ingredientId: testIngredientId.toString(),
        targetPrice: 'invalid',
        type: 'invalid',
      };

      const response = await request(app)
        .post('/api/prices/alerts')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it("should get user's price alerts", async () => {
      // Add some alerts
      await db.collection('priceAlerts').insertMany([
        {
          ingredientId: testIngredientId,
          userId: testUserId,
          targetPrice: 9.99,
          type: 'below',
          createdAt: new Date(),
          triggered: false,
        },
        {
          ingredientId: testIngredientId,
          userId: testUserId,
          targetPrice: 15.99,
          type: 'above',
          createdAt: new Date(),
          triggered: false,
        },
      ]);

      const response = await request(app)
        .get('/api/prices/alerts/my-alerts')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('ingredient');
      expect(response.body.data[0].ingredient).toHaveProperty('name');
      expect(response.body.data[0].ingredient).toHaveProperty('currentPrice');
    });

    it('should delete a price alert', async () => {
      // Create an alert to delete
      const result = await db.collection('priceAlerts').insertOne({
        ingredientId: testIngredientId,
        userId: testUserId,
        targetPrice: 9.99,
        type: 'below',
        createdAt: new Date(),
        triggered: false,
      });

      const response = await request(app)
        .delete(`/api/prices/alerts/${result.insertedId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify alert is deleted
      const alert = await db.collection('priceAlerts').findOne({
        _id: result.insertedId,
      });
      expect(alert).toBeNull();
    });

    it("should not delete another user's alert", async () => {
      // Create an alert for another user
      const result = await db.collection('priceAlerts').insertOne({
        ingredientId: testIngredientId,
        userId: new ObjectId(),
        targetPrice: 9.99,
        type: 'below',
        createdAt: new Date(),
        triggered: false,
      });

      const response = await request(app)
        .delete(`/api/prices/alerts/${result.insertedId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);

      // Verify alert still exists
      const alert = await db.collection('priceAlerts').findOne({
        _id: result.insertedId,
      });
      expect(alert).not.toBeNull();
    });

    it('should check price alerts when price changes', async () => {
      // Create an alert that should be triggered
      const alert = await db.collection('priceAlerts').insertOne({
        ingredientId: testIngredientId,
        userId: testUserId,
        targetPrice: 11.99,
        type: 'below',
        createdAt: new Date(),
        triggered: false,
      });

      // Simulate price change by calling internal function
      const { checkPriceAlerts } = await import('../price.js');
      await checkPriceAlerts(testIngredientId, 10.99);

      // Verify alert is marked as triggered
      const updatedAlert = await db.collection('priceAlerts').findOne({
        _id: alert.insertedId,
      });
      expect(updatedAlert.triggered).toBe(true);
      expect(updatedAlert.triggerPrice).toBe(10.99);
      expect(updatedAlert.triggeredAt).toBeDefined();
    });
  });
});
