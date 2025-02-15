const { getDb } = require('../db');
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

class SitemapService {
  constructor() {
    this.baseUrl = 'https://rezepta.com';
    this.CHANGE_FREQ = {
      RECIPES: 'weekly',
      COLLECTIONS: 'daily',
      STATIC: 'monthly',
    };
  }

  async generateRecipesSitemap() {
    const db = getDb();
    const recipes = await db
      .collection('recipes')
      .find({ status: 'published' }, { projection: { slug: 1, updated_at: 1, images: 1 } })
      .toArray();

    const links = recipes.map(recipe => ({
      url: `/recipes/${recipe.slug}`,
      changefreq: this.CHANGE_FREQ.RECIPES,
      priority: 0.8,
      lastmod: recipe.updated_at.toISOString(),
      img: recipe.images?.map(img => ({
        url: img.variants?.large?.url,
        caption: img.caption,
        title: img.alt_text,
      })),
    }));

    return this.createSitemap(links);
  }

  async generateCollectionsSitemap() {
    const db = getDb();
    const collections = await db
      .collection('collections')
      .find({ status: 'published' }, { projection: { slug: 1, updated_at: 1 } })
      .toArray();

    const links = collections.map(collection => ({
      url: `/collections/${collection.slug}`,
      changefreq: this.CHANGE_FREQ.COLLECTIONS,
      priority: 0.7,
      lastmod: collection.updated_at.toISOString(),
    }));

    return this.createSitemap(links);
  }

  generateStaticSitemap() {
    const staticPages = [
      { url: '/', priority: 1.0 },
      { url: '/about', priority: 0.5 },
      { url: '/contact', priority: 0.5 },
      { url: '/terms', priority: 0.3 },
      { url: '/privacy', priority: 0.3 },
    ];

    const links = staticPages.map(page => ({
      url: page.url,
      changefreq: this.CHANGE_FREQ.STATIC,
      priority: page.priority,
    }));

    return this.createSitemap(links);
  }

  async createSitemap(links) {
    const stream = new SitemapStream({ hostname: this.baseUrl });
    return streamToPromise(Readable.from(links).pipe(stream)).then(data => data.toString());
  }

  async generateSitemapIndex() {
    const sitemaps = [
      `${this.baseUrl}/sitemaps/recipes.xml`,
      `${this.baseUrl}/sitemaps/collections.xml`,
      `${this.baseUrl}/sitemaps/static.xml`,
    ];

    const links = sitemaps.map(url => ({
      url,
      lastmod: new Date().toISOString(),
    }));

    return this.createSitemap(links);
  }

  async generateRobotsTxt() {
    return `
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /user/*/settings
Disallow: /search

Sitemap: ${this.baseUrl}/sitemap.xml
    `.trim();
  }
}

module.exports = new SitemapService();
