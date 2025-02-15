const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const paymentManager = require('../../services/payment-manager');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validatePaymentMethod = [
  body('cardNumber')
    .isString()
    .matches(/^\d{16}$/)
    .withMessage('Invalid card number'),
  body('expiryMonth').isInt({ min: 1, max: 12 }).withMessage('Invalid expiry month'),
  body('expiryYear').isInt({ min: new Date().getFullYear() }).withMessage('Invalid expiry year'),
  body('cvc')
    .isString()
    .matches(/^\d{3,4}$/)
    .withMessage('Invalid CVC'),
  body('name').isString().trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Invalid email'),
  body('address').isObject().withMessage('Address must be an object'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean'),
];

const validateRefundRequest = [
  body('paymentId').isString().notEmpty().withMessage('Payment ID is required'),
  body('reason')
    .isString()
    .custom(value => {
      if (!Object.values(paymentManager.REFUND_REASONS).includes(value)) {
        throw new Error('Invalid refund reason');
      }
      return true;
    }),
  body('details').optional().isString().withMessage('Details must be a string'),
];

// Add payment method
router.post(
  '/methods',
  auth,
  rateLimiter.api(),
  validatePaymentMethod,
  validateRequest,
  async (req, res) => {
    try {
      const paymentMethod = await paymentManager.addPaymentMethod(req.user.id, req.body);

      res.json({
        success: true,
        data: paymentMethod,
        message: 'Payment method added successfully',
      });
    } catch (err) {
      console.error('Error adding payment method:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error adding payment method',
      });
    }
  }
);

// Get payment methods
router.get('/methods', auth, rateLimiter.api(), async (req, res) => {
  try {
    const methods = await paymentManager.getPaymentMethods(req.user.id);

    res.json({
      success: true,
      data: methods,
    });
  } catch (err) {
    console.error('Error getting payment methods:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting payment methods',
    });
  }
});

// Set default payment method
router.put('/methods/:methodId/default', auth, rateLimiter.api(), async (req, res) => {
  try {
    await paymentManager.setDefaultPaymentMethod(req.user.id, req.params.methodId);

    res.json({
      success: true,
      message: 'Default payment method updated successfully',
    });
  } catch (err) {
    console.error('Error setting default payment method:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error setting default payment method',
    });
  }
});

// Remove payment method
router.delete('/methods/:methodId', auth, rateLimiter.api(), async (req, res) => {
  try {
    await paymentManager.removePaymentMethod(req.user.id, req.params.methodId);

    res.json({
      success: true,
      message: 'Payment method removed successfully',
    });
  } catch (err) {
    console.error('Error removing payment method:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error removing payment method',
    });
  }
});

// Request refund
router.post(
  '/refunds',
  auth,
  rateLimiter.api(),
  validateRefundRequest,
  validateRequest,
  async (req, res) => {
    try {
      const refundRequest = await paymentManager.requestRefund(
        req.user.id,
        req.body.paymentId,
        req.body.reason,
        req.body.details
      );

      res.json({
        success: true,
        data: refundRequest,
        message: 'Refund request created successfully',
      });
    } catch (err) {
      console.error('Error requesting refund:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error requesting refund',
      });
    }
  }
);

// Get refund requests
router.get('/refunds', auth, rateLimiter.api(), async (req, res) => {
  try {
    const status = req.query.status || null;
    const requests = await paymentManager.getRefundRequests(req.user.id, status);

    res.json({
      success: true,
      data: requests,
    });
  } catch (err) {
    console.error('Error getting refund requests:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting refund requests',
    });
  }
});

// Process refund (admin only)
router.post(
  '/refunds/:refundId/process',
  auth,
  rateLimiter.admin(),
  body('approved').isBoolean().withMessage('Approved must be a boolean'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  validateRequest,
  async (req, res) => {
    try {
      await paymentManager.processRefund(req.params.refundId, req.body.approved, req.body.notes);

      res.json({
        success: true,
        message: 'Refund processed successfully',
      });
    } catch (err) {
      console.error('Error processing refund:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error processing refund',
      });
    }
  }
);

// Get supported options
router.get('/options', auth, rateLimiter.api(), async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        paymentMethodTypes: paymentManager.PAYMENT_METHOD_TYPES,
        refundReasons: paymentManager.REFUND_REASONS,
        refundStatus: paymentManager.REFUND_STATUS,
      },
    });
  } catch (err) {
    console.error('Error getting payment options:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting payment options',
    });
  }
});

module.exports = router;
