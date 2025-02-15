const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../../middleware/validate-request');
const auth = require('../../middleware/auth');
const localizationManager = require('../../services/localization-manager');
const rateLimiter = require('../../middleware/rate-limit');

// Validation middleware
const validateSettings = [
  body('language')
    .optional()
    .isString()
    .custom(value => {
      if (!localizationManager.SUPPORTED_LANGUAGES[value]) {
        throw new Error('Unsupported language');
      }
      return true;
    }),
  body('region')
    .optional()
    .isString()
    .isLength({ min: 2, max: 2 })
    .toUpperCase()
    .withMessage('Region must be a 2-letter country code'),
  body('measurementSystem')
    .optional()
    .isIn(Object.values(localizationManager.MEASUREMENT_SYSTEMS))
    .withMessage('Invalid measurement system'),
  body('dateFormat')
    .optional()
    .isIn(Object.values(localizationManager.DATE_FORMATS))
    .withMessage('Invalid date format'),
  body('timeFormat')
    .optional()
    .isIn(Object.values(localizationManager.TIME_FORMATS))
    .withMessage('Invalid time format'),
  body('currency')
    .optional()
    .isString()
    .custom(value => {
      if (!localizationManager.CURRENCY_FORMATS[value]) {
        throw new Error('Unsupported currency');
      }
      return true;
    }),
  body('timezone')
    .optional()
    .isString()
    .custom(value => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
      } catch (e) {
        throw new Error('Invalid timezone');
      }
    }),
];

// Get localization settings
router.get('/', auth, rateLimiter.api(), async (req, res) => {
  try {
    const settings = await localizationManager.getSettings(req.user.id);

    res.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    console.error('Error getting localization settings:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting localization settings',
    });
  }
});

// Update localization settings
router.put('/', auth, rateLimiter.api(), validateSettings, validateRequest, async (req, res) => {
  try {
    const success = await localizationManager.updateSettings(req.user.id, req.body);

    res.json({
      success: true,
      message: 'Localization settings updated successfully',
    });
  } catch (err) {
    console.error('Error updating localization settings:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error updating localization settings',
    });
  }
});

// Get supported options
router.get('/options', auth, rateLimiter.api(), async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        languages: localizationManager.SUPPORTED_LANGUAGES,
        measurementSystems: localizationManager.MEASUREMENT_SYSTEMS,
        dateFormats: localizationManager.DATE_FORMATS,
        timeFormats: localizationManager.TIME_FORMATS,
        currencies: localizationManager.CURRENCY_FORMATS,
      },
    });
  } catch (err) {
    console.error('Error getting localization options:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error getting localization options',
    });
  }
});

// Format a value according to user's settings
router.post(
  '/format',
  auth,
  rateLimiter.api(),
  body('value').exists().withMessage('Value is required'),
  body('type').isIn(['date', 'time', 'currency', 'measurement']).withMessage('Invalid format type'),
  validateRequest,
  async (req, res) => {
    try {
      const formattedValue = await localizationManager.formatValue(
        req.user.id,
        req.body.value,
        req.body.type
      );

      res.json({
        success: true,
        data: formattedValue,
      });
    } catch (err) {
      console.error('Error formatting value:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Error formatting value',
      });
    }
  }
);

module.exports = router;
