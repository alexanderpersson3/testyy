const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentManager {
  constructor() {
    this.PAYMENT_METHOD_TYPES = {
      CREDIT_CARD: 'credit_card',
      DEBIT_CARD: 'debit_card',
      BANK_ACCOUNT: 'bank_account'
    };

    this.REFUND_REASONS = {
      DUPLICATE: 'duplicate',
      FRAUDULENT: 'fraudulent',
      REQUESTED_BY_CUSTOMER: 'requested_by_customer',
      SUBSCRIPTION_CANCELLED: 'subscription_cancelled'
    };

    this.REFUND_STATUS = {
      PENDING: 'pending',
      PROCESSED: 'processed',
      FAILED: 'failed'
    };
  }

  async addPaymentMethod(userId, paymentDetails) {
    try {
      const db = getDb();

      // Create payment method in Stripe
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: paymentDetails.cardNumber,
          exp_month: paymentDetails.expiryMonth,
          exp_year: paymentDetails.expiryYear,
          cvc: paymentDetails.cvc
        },
        billing_details: {
          name: paymentDetails.name,
          email: paymentDetails.email,
          address: paymentDetails.address
        }
      });

      // Store reference in our database
      const paymentMethodRecord = {
        userId: new ObjectId(userId),
        stripePaymentMethodId: paymentMethod.id,
        type: this.PAYMENT_METHOD_TYPES.CREDIT_CARD,
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        expiryMonth: paymentMethod.card.exp_month,
        expiryYear: paymentMethod.card.exp_year,
        isDefault: paymentDetails.isDefault || false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // If this is the default payment method, unset any existing default
      if (paymentMethodRecord.isDefault) {
        await db.collection('payment_methods').updateMany(
          { userId: new ObjectId(userId) },
          { $set: { isDefault: false } }
        );
      }

      await db.collection('payment_methods').insertOne(paymentMethodRecord);

      await auditLogger.log(
        auditLogger.eventTypes.PAYMENT.METHOD_ADD,
        { userId, paymentMethodId: paymentMethod.id },
        { severity: auditLogger.severityLevels.INFO }
      );

      return paymentMethodRecord;
    } catch (err) {
      console.error('Error adding payment method:', err);
      throw err;
    }
  }

  async getPaymentMethods(userId) {
    try {
      const db = getDb();
      
      const methods = await db.collection('payment_methods')
        .find({ userId: new ObjectId(userId) })
        .sort({ isDefault: -1, createdAt: -1 })
        .toArray();

      return methods;
    } catch (err) {
      console.error('Error getting payment methods:', err);
      throw err;
    }
  }

  async setDefaultPaymentMethod(userId, paymentMethodId) {
    try {
      const db = getDb();
      
      // Unset any existing default
      await db.collection('payment_methods').updateMany(
        { userId: new ObjectId(userId) },
        { $set: { isDefault: false } }
      );

      // Set new default
      const updateResult = await db.collection('payment_methods').updateOne(
        { 
          _id: new ObjectId(paymentMethodId),
          userId: new ObjectId(userId)
        },
        { $set: { isDefault: true, updatedAt: new Date() } }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error('Payment method not found');
      }

      await auditLogger.log(
        auditLogger.eventTypes.PAYMENT.METHOD_DEFAULT_SET,
        { userId, paymentMethodId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error setting default payment method:', err);
      throw err;
    }
  }

  async removePaymentMethod(userId, paymentMethodId) {
    try {
      const db = getDb();
      
      const paymentMethod = await db.collection('payment_methods').findOne({
        _id: new ObjectId(paymentMethodId),
        userId: new ObjectId(userId)
      });

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Remove from Stripe
      await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);

      // Remove from our database
      await db.collection('payment_methods').deleteOne({
        _id: new ObjectId(paymentMethodId)
      });

      await auditLogger.log(
        auditLogger.eventTypes.PAYMENT.METHOD_REMOVE,
        { userId, paymentMethodId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error removing payment method:', err);
      throw err;
    }
  }

  async requestRefund(userId, paymentId, reason, details = '') {
    try {
      const db = getDb();
      
      if (!Object.values(this.REFUND_REASONS).includes(reason)) {
        throw new Error('Invalid refund reason');
      }

      const refundRequest = {
        userId: new ObjectId(userId),
        paymentId,
        reason,
        details,
        status: this.REFUND_STATUS.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('refund_requests').insertOne(refundRequest);

      await auditLogger.log(
        auditLogger.eventTypes.PAYMENT.REFUND_REQUEST,
        { userId, paymentId, reason },
        { severity: auditLogger.severityLevels.INFO }
      );

      return refundRequest;
    } catch (err) {
      console.error('Error requesting refund:', err);
      throw err;
    }
  }

  async processRefund(refundId, approved, notes = '') {
    try {
      const db = getDb();
      
      const refundRequest = await db.collection('refund_requests').findOne({
        _id: new ObjectId(refundId)
      });

      if (!refundRequest) {
        throw new Error('Refund request not found');
      }

      if (approved) {
        // Process refund in Stripe
        const refund = await stripe.refunds.create({
          payment_intent: refundRequest.paymentId,
          reason: refundRequest.reason
        });

        // Update refund request status
        await db.collection('refund_requests').updateOne(
          { _id: new ObjectId(refundId) },
          {
            $set: {
              status: this.REFUND_STATUS.PROCESSED,
              stripeRefundId: refund.id,
              notes,
              updatedAt: new Date()
            }
          }
        );
      } else {
        // Update refund request status as failed
        await db.collection('refund_requests').updateOne(
          { _id: new ObjectId(refundId) },
          {
            $set: {
              status: this.REFUND_STATUS.FAILED,
              notes,
              updatedAt: new Date()
            }
          }
        );
      }

      await auditLogger.log(
        auditLogger.eventTypes.PAYMENT.REFUND_PROCESS,
        { refundId, approved, userId: refundRequest.userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error processing refund:', err);
      throw err;
    }
  }

  async getRefundRequests(userId, status = null) {
    try {
      const db = getDb();
      
      const query = { userId: new ObjectId(userId) };
      if (status) {
        if (!Object.values(this.REFUND_STATUS).includes(status)) {
          throw new Error('Invalid refund status');
        }
        query.status = status;
      }

      const requests = await db.collection('refund_requests')
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      return requests;
    } catch (err) {
      console.error('Error getting refund requests:', err);
      throw err;
    }
  }
}

module.exports = new PaymentManager(); 