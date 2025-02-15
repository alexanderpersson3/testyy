const Redis = require('ioredis');
const { promisify } = require('util');
const auditLogger = require('./audit-logger');

class RateLimiter {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.incr = promisify(this.redis.incr).bind(this.redis);
    this.expire = promisify(this.redis.expire).bind(this.redis);

    // Default limits for different types of operations
    this.limits = {
      auth: { points: 5, duration: 300 }, // 5 attempts per 5 minutes for auth
      api: { points: 100, duration: 60 }, // 100 requests per minute for general API
      search: { points: 30, duration: 60 }, // 30 searches per minute
      admin: { points: 300, duration: 60 }, // 300 requests per minute for admin
    };
  }

  getKey(type, identifier) {
    return `rate_limit:${type}:${identifier}`;
  }

  async isRateLimited(type, identifier) {
    try {
      const key = this.getKey(type, identifier);
      const limit = this.limits[type] || this.limits.api;

      // Increment the counter
      const count = await this.incr(key);

      // Set expiry on first request
      if (count === 1) {
        await this.expire(key, limit.duration);
      }

      // Check if rate limited
      const isLimited = count > limit.points;

      // Log if rate limited
      if (isLimited) {
        await auditLogger.log(
          auditLogger.eventTypes.SECURITY.SUSPICIOUS_ACTIVITY,
          {
            type: 'rate_limit_exceeded',
            limitType: type,
            identifier,
            count,
          },
          {
            severity: auditLogger.severityLevels.WARNING,
          }
        );
      }

      return {
        isLimited,
        remaining: Math.max(0, limit.points - count),
        resetTime: limit.duration,
      };
    } catch (err) {
      console.error('Rate limiter error:', err);
      // Fail open - allow request if Redis is down
      return {
        isLimited: false,
        remaining: 1,
        resetTime: 60,
      };
    }
  }

  // Get current rate limit status without incrementing
  async getRateStatus(type, identifier) {
    try {
      const key = this.getKey(type, identifier);
      const count = await this.redis.get(key);
      const limit = this.limits[type] || this.limits.api;
      const ttl = await this.redis.ttl(key);

      return {
        current: parseInt(count) || 0,
        limit: limit.points,
        remaining: Math.max(0, limit.points - (parseInt(count) || 0)),
        resetTime: ttl > 0 ? ttl : limit.duration,
      };
    } catch (err) {
      console.error('Error getting rate status:', err);
      return null;
    }
  }

  // Reset rate limit for a specific type and identifier
  async resetLimit(type, identifier) {
    try {
      const key = this.getKey(type, identifier);
      await this.redis.del(key);
      return true;
    } catch (err) {
      console.error('Error resetting rate limit:', err);
      return false;
    }
  }

  // Update rate limit configuration
  updateLimits(newLimits) {
    this.limits = { ...this.limits, ...newLimits };
  }
}

module.exports = new RateLimiter();
