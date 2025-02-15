const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class LocalizationManager {
  constructor() {
    // Supported languages with their codes and names
    this.SUPPORTED_LANGUAGES = {
      en: {
        name: 'English',
        defaultRegion: 'US',
      },
      es: {
        name: 'Español',
        defaultRegion: 'ES',
      },
      fr: {
        name: 'Français',
        defaultRegion: 'FR',
      },
      de: {
        name: 'Deutsch',
        defaultRegion: 'DE',
      },
    };

    // Supported measurement systems
    this.MEASUREMENT_SYSTEMS = {
      METRIC: 'metric',
      IMPERIAL: 'imperial',
    };

    // Supported date formats
    this.DATE_FORMATS = {
      ISO: 'YYYY-MM-DD',
      US: 'MM/DD/YYYY',
      EU: 'DD/MM/YYYY',
    };

    // Supported time formats
    this.TIME_FORMATS = {
      H24: '24h',
      H12: '12h',
    };

    // Supported currency formats
    this.CURRENCY_FORMATS = {
      USD: {
        symbol: '$',
        position: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
      EUR: {
        symbol: '€',
        position: 'after',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      },
      GBP: {
        symbol: '£',
        position: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
      },
    };

    // Default settings
    this.DEFAULT_SETTINGS = {
      language: 'en',
      region: 'US',
      measurementSystem: this.MEASUREMENT_SYSTEMS.METRIC,
      dateFormat: this.DATE_FORMATS.ISO,
      timeFormat: this.TIME_FORMATS.H24,
      currency: 'USD',
      timezone: 'UTC',
    };
  }

  async getSettings(userId) {
    try {
      const db = getDb();

      let settings = await db.collection('localization_settings').findOne({
        userId: new ObjectId(userId),
      });

      if (!settings) {
        // Create default settings if none exist
        settings = {
          userId: new ObjectId(userId),
          ...this.DEFAULT_SETTINGS,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.collection('localization_settings').insertOne(settings);

        await auditLogger.log(
          auditLogger.eventTypes.USER.LOCALIZATION_CREATE,
          { userId },
          { severity: auditLogger.severityLevels.INFO }
        );
      }

      return settings;
    } catch (err) {
      console.error('Error getting localization settings:', err);
      throw err;
    }
  }

  async updateSettings(userId, updates) {
    try {
      const db = getDb();

      // Validate language
      if (updates.language && !this.SUPPORTED_LANGUAGES[updates.language]) {
        throw new Error('Unsupported language');
      }

      // Validate measurement system
      if (
        updates.measurementSystem &&
        !Object.values(this.MEASUREMENT_SYSTEMS).includes(updates.measurementSystem)
      ) {
        throw new Error('Invalid measurement system');
      }

      // Validate date format
      if (updates.dateFormat && !Object.values(this.DATE_FORMATS).includes(updates.dateFormat)) {
        throw new Error('Invalid date format');
      }

      // Validate time format
      if (updates.timeFormat && !Object.values(this.TIME_FORMATS).includes(updates.timeFormat)) {
        throw new Error('Invalid time format');
      }

      // Validate currency
      if (updates.currency && !this.CURRENCY_FORMATS[updates.currency]) {
        throw new Error('Unsupported currency');
      }

      // Validate timezone
      if (updates.timezone) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: updates.timezone });
        } catch (e) {
          throw new Error('Invalid timezone');
        }
      }

      const updateResult = await db.collection('localization_settings').updateOne(
        { userId: new ObjectId(userId) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.LOCALIZATION_UPDATE,
        { userId, updates },
        { severity: auditLogger.severityLevels.INFO }
      );

      return updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0;
    } catch (err) {
      console.error('Error updating localization settings:', err);
      throw err;
    }
  }

  async formatValue(userId, value, type) {
    try {
      const settings = await this.getSettings(userId);

      switch (type) {
        case 'date':
          return this._formatDate(value, settings.dateFormat);
        case 'time':
          return this._formatTime(value, settings.timeFormat);
        case 'currency':
          return this._formatCurrency(value, settings.currency);
        case 'measurement':
          return this._formatMeasurement(value, settings.measurementSystem);
        default:
          throw new Error('Unsupported format type');
      }
    } catch (err) {
      console.error('Error formatting value:', err);
      throw err;
    }
  }

  _formatDate(date, format) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    switch (format) {
      case this.DATE_FORMATS.ISO:
        return `${year}-${month}-${day}`;
      case this.DATE_FORMATS.US:
        return `${month}/${day}/${year}`;
      case this.DATE_FORMATS.EU:
        return `${day}/${month}/${year}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }

  _formatTime(time, format) {
    const d = new Date(time);
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');

    if (format === this.TIME_FORMATS.H12) {
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes} ${period}`;
    }

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  _formatCurrency(amount, currency) {
    const format = this.CURRENCY_FORMATS[currency];
    const formattedAmount = amount
      .toFixed(2)
      .replace('.', format.decimalSeparator)
      .replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandsSeparator);

    return format.position === 'before'
      ? `${format.symbol}${formattedAmount}`
      : `${formattedAmount}${format.symbol}`;
  }

  _formatMeasurement(value, system) {
    if (system === this.MEASUREMENT_SYSTEMS.IMPERIAL) {
      // Convert from metric to imperial
      return {
        weight: value.weight * 2.20462, // kg to lbs
        volume: value.volume * 33.814, // liters to fl oz
        temperature: (value.temperature * 9) / 5 + 32, // Celsius to Fahrenheit
      };
    }
    return value; // Already in metric
  }
}

module.exports = new LocalizationManager();
