import request from 'supertest';
import { app } from '../app.js';
import { getDb } from '../config/db.js';
import { createStructuredLog } from '../config/cloud.js';
import { verifyAppleReceipt, verifyGooglePurchase } from '../services/payment-verification.js';

// Mock external API calls
jest.mock('../services/payment-verification.js');
jest.mock('../services/payment-verification', () => ({
  verifyPayment: jest.fn()
}));

describe('Subscription & Payment Tests', () => {
  let db;
  let testUser;
  let userToken;

  beforeAll(async () => {
    db = await getDb();
    testUser = await db.collection('users').insertOne({
      email: 'test@example.com',
      username: 'testuser',
      subscription: {
        status: 'inactive',
        plan: null,
        expiresAt: null
      }
    });

    userToken = jwt.sign(
      { userId: testUser.insertedId.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await db.collection('users').deleteOne({ _id: testUser.insertedId });
  });

  describe('iOS Purchase Verification', () => {
    beforeEach(() => {
      verifyAppleReceipt.mockClear();
    });

    it('should verify valid iOS receipt', async () => {
      verifyAppleReceipt.mockResolvedValue({
        status: 0,
        latest_receipt_info: [{
          product_id: 'premium_monthly',
          expires_date_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
          original_transaction_id: '1000000'
        }]
      });

      const res = await request(app)
        .post('/api/subscription/verify/ios')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          receipt: 'valid_receipt_data',
          productId: 'premium_monthly'
        });

      expect(res.status).toBe(200);
      expect(res.body.subscription.status).toBe('active');
      expect(res.body.subscription.plan).toBe('premium_monthly');
    });

    it('should handle invalid iOS receipt', async () => {
      verifyAppleReceipt.mockResolvedValue({
        status: 21007,
        message: 'Invalid receipt'
      });

      const res = await request(app)
        .post('/api/subscription/verify/ios')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          receipt: 'invalid_receipt_data',
          productId: 'premium_monthly'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should handle sandbox receipts in production', async () => {
      verifyAppleReceipt.mockResolvedValue({
        status: 21007,
        message: 'Sandbox receipt sent to production'
      });

      const res = await request(app)
        .post('/api/subscription/verify/ios')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          receipt: 'sandbox_receipt_data',
          productId: 'premium_monthly'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('sandbox');
    });
  });

  describe('Android Purchase Verification', () => {
    beforeEach(() => {
      verifyGooglePurchase.mockClear();
    });

    it('should verify valid Android purchase token', async () => {
      verifyGooglePurchase.mockResolvedValue({
        purchaseState: 0,
        consumptionState: 0,
        productId: 'premium_monthly',
        purchaseTimeMillis: Date.now(),
        expiryTimeMillis: Date.now() + 30 * 24 * 60 * 60 * 1000
      });

      const res = await request(app)
        .post('/api/subscription/verify/android')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purchaseToken: 'valid_purchase_token',
          productId: 'premium_monthly',
          packageName: 'com.rezepta.app'
        });

      expect(res.status).toBe(200);
      expect(res.body.subscription.status).toBe('active');
      expect(res.body.subscription.plan).toBe('premium_monthly');
    });

    it('should handle invalid Android purchase token', async () => {
      verifyGooglePurchase.mockRejectedValue(new Error('Invalid purchase token'));

      const res = await request(app)
        .post('/api/subscription/verify/android')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          purchaseToken: 'invalid_purchase_token',
          productId: 'premium_monthly',
          packageName: 'com.rezepta.app'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Subscription Status Management', () => {
    it('should handle subscription expiration', async () => {
      // Set up expired subscription
      await db.collection('users').updateOne(
        { _id: testUser.insertedId },
        {
          $set: {
            subscription: {
              status: 'active',
              plan: 'premium_monthly',
              expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }
      );

      const res = await request(app)
        .get('/api/subscription/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscription.status).toBe('expired');
    });

    it('should handle grace period', async () => {
      // Set up subscription in grace period
      await db.collection('users').updateOne(
        { _id: testUser.insertedId },
        {
          $set: {
            subscription: {
              status: 'grace_period',
              plan: 'premium_monthly',
              expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              gracePeriodEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          }
        }
      );

      const res = await request(app)
        .get('/api/subscription/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscription.status).toBe('grace_period');
      expect(res.body.subscription.gracePeriodEndsAt).toBeDefined();
    });
  });

  describe('Subscription Webhooks', () => {
    it('should handle iOS server-to-server notifications', async () => {
      const res = await request(app)
        .post('/api/subscription/webhook/ios')
        .send({
          notification_type: 'RENEWAL',
          unified_receipt: {
            latest_receipt_info: [{
              product_id: 'premium_monthly',
              expires_date_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
              original_transaction_id: '1000000'
            }]
          }
        });

      expect(res.status).toBe(200);
      
      const user = await db.collection('users').findOne({
        'subscription.originalTransactionId': '1000000'
      });
      expect(user.subscription.status).toBe('active');
    });

    it('should handle Android real-time developer notifications', async () => {
      const res = await request(app)
        .post('/api/subscription/webhook/android')
        .send({
          message: {
            data: Buffer.from(JSON.stringify({
              subscriptionNotification: {
                purchaseToken: 'valid_purchase_token',
                subscriptionId: 'premium_monthly',
                notificationType: 1 // RENEWED
              }
            })).toString('base64')
          }
        });

      expect(res.status).toBe(200);
      
      const user = await db.collection('users').findOne({
        'subscription.purchaseToken': 'valid_purchase_token'
      });
      expect(user.subscription.status).toBe('active');
    });
  });
}); 