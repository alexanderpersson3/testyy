import express, { Request, Response, NextFunction } from 'express';
import sitemapService from '../services/sitemap-service.js';
import cache from 'memory-cache';

const router = express.Router();

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Middleware to set XML content type
const setXmlContentType = (req: Request, res: Response, next: NextFunction) => {
  res.header('Content-Type', 'application/xml');
  next();
};

// Middleware to set text content type
const setTextContentType = (req: Request, res: Response, next: NextFunction) => {
  res.header('Content-Type', 'text/plain');
  next();
};

// Cache middleware
const cacheMiddleware = (key: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const cachedContent = cache.get(key);
    if (cachedContent) {
      return res.send(cachedContent);
    }
    next();
  };
};

// Main sitemap index
router.get(
  '/sitemap.xml',
  setXmlContentType,
  cacheMiddleware('sitemap-index'),
  async (req: Request, res: Response) => {
    try {
      const sitemap = await sitemapService.generateSitemapIndex();
      cache.put('sitemap-index', sitemap, CACHE_DURATION);
      res.send(sitemap);
    } catch (err: any) {
      console.error('Generate sitemap index error:', err);
      res.status(500).send('Error generating sitemap index');
    }
  }
);

// Recipes sitemap
router.get(
  '/sitemaps/recipes.xml',
  setXmlContentType,
  cacheMiddleware('sitemap-recipes'),
  async (req: Request, res: Response) => {
    try {
      const sitemap = await sitemapService.generateRecipesSitemap();
      cache.put('sitemap-recipes', sitemap, CACHE_DURATION);
      res.send(sitemap);
    } catch (err: any) {
      console.error('Generate recipes sitemap error:', err);
      res.status(500).send('Error generating recipes sitemap');
    }
  }
);

// Collections sitemap
router.get(
  '/sitemaps/collections.xml',
  setXmlContentType,
  cacheMiddleware('sitemap-collections'),
  async (req: Request, res: Response) => {
    try {
      const sitemap = await sitemapService.generateCollectionsSitemap();
      cache.put('sitemap-collections', sitemap, CACHE_DURATION);
      res.send(sitemap);
    } catch (err: any) {
      console.error('Generate collections sitemap error:', err);
      res.status(500).send('Error generating collections sitemap');
    }
  }
);

// Static pages sitemap
router.get(
  '/sitemaps/static.xml',
  setXmlContentType,
  cacheMiddleware('sitemap-static'),
  async (req: Request, res: Response) => {
    try {
      const sitemap = await sitemapService.generateStaticSitemap();
      cache.put('sitemap-static', sitemap, CACHE_DURATION);
      res.send(sitemap);
    } catch (err: any) {
      console.error('Generate static sitemap error:', err);
      res.status(500).send('Error generating static sitemap');
    }
  }
);

// Robots.txt
router.get('/robots.txt', setTextContentType, cacheMiddleware('robots-txt'), async (req: Request, res: Response) => {
  try {
    const robotsTxt = await sitemapService.generateRobotsTxt();
    cache.put('robots-txt', robotsTxt, CACHE_DURATION);
    res.send(robotsTxt);
  } catch (err: any) {
    console.error('Generate robots.txt error:', err);
    res.status(500).send('Error generating robots.txt');
  }
});

export default router;