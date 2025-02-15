import { Express } from 'express';
import { CacheService } from '../cache/cache.service';
import { CacheDashboard } from './cache-dashboard';

export class MonitoringModule {
  static register(app: Express, cacheService: CacheService): void {
    const cacheDashboard = new CacheDashboard(cacheService);
    app.use('/cache', cacheDashboard.getRouter());
  }
} 