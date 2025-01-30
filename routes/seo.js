const express = require('express');
const router = express.Router();
const sitemapService = require('../services/sitemap-service');
const cache = require('memory-cache');

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Middleware to set XML content type
const setXmlContentType = (req, res, next) => {
  res.header('Content-Type', 'application/xml');
  next();
};

// Middleware to set text content type
const setTextContentType = (req, res, next) => {
  res.header('Content-Type', 'text/plain');
  next();
};

// Cache middleware
const cacheMiddleware = (key) => {
  return (req, res, next) => {
    const cachedContent = cache.get(key);
    if (cachedContent) {
      return res.send(cachedContent);
    }
    next();
  };
};

// Main sitemap index
router.get('/sitemap.xml',
  setXmlContentType,
  cacheMiddleware('sitemap-index'),
  async (req, res) => {
    try {
      const sitemap = await sitemapService.generateSitemapIndex();
      cache.put('sitemap-index', sitemap, CACHE_DURATION);
      res.send(sitemap);
    } catch (err) {
      console.error('Generate sitemap index error:', err);
      res.status(500).send('Error generating sitemap index');
    }
  }
);

// Recipes sitemap
router.get('/sitemaps/recipes.xml',
  setXmlContentType,
  cacheMiddleware('sitemap-recipes'),
  async (req, res) => {
    try {
      const sitemap = await sitemapService.generateRecipesSitemap();
      cache.put('sitemap-recipes', sitemap, CACHE_DURATION);
      res.send(sitemap);
    } catch (err) {
      console.error('Generate recipes sitemap error:', err);
      res.status(500).send('Error generating recipes sitemap');
    }
  }
);

// Collections sitemap
router.get('/sitemaps/collections.xml',
  setXmlContentType,
  cacheMiddleware('sitemap-collections'),
  async (req, res) => {
    try {
      const sitemap = await sitemapService.generateCollectionsSitemap();
      cache.put('sitemap-collections', sitemap, CACHE_DURATION);
      res.send(sitemap);
    } catch (err) {
      console.error('Generate collections sitemap error:', err);
      res.status(500).send('Error generating collections sitemap');
    }
  }
);

// Static pages sitemap
router.get('/sitemaps/static.xml',
  setXmlContentType,
  cacheMiddleware('sitemap-static'),
  async (req, res) => {
    try {
      const sitemap = await sitemapService.generateStaticSitemap();
      cache.put('sitemap-static', sitemap, CACHE_DURATION);
      res.send(sitemap);
    } catch (err) {
      console.error('Generate static sitemap error:', err);
      res.status(500).send('Error generating static sitemap');
    }
  }
);

// Robots.txt
router.get('/robots.txt',
  setTextContentType,
  cacheMiddleware('robots-txt'),
  async (req, res) => {
    try {
      const robotsTxt = await sitemapService.generateRobotsTxt();
      cache.put('robots-txt', robotsTxt, CACHE_DURATION);
      res.send(robotsTxt);
    } catch (err) {
      console.error('Generate robots.txt error:', err);
      res.status(500).send('Error generating robots.txt');
    }
  }
);

module.exports = router; 