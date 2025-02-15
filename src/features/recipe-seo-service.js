const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const slugify = require('slugify');
const imageSize = require('image-size');
const sharp = require('sharp');

class RecipeSeoService {
  constructor() {
    this.RECIPE_IMAGE_SIZES = {
      THUMBNAIL: { width: 300, height: 300 },
      MEDIUM: { width: 600, height: 600 },
      LARGE: { width: 1200, height: 1200 },
    };
  }

  async generateUniqueSlug(title, existingId = null) {
    const db = getDb();
    let baseSlug = slugify(title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });

    let slug = baseSlug;
    let counter = 1;
    let exists = true;

    while (exists) {
      const query = { slug };
      if (existingId) {
        query._id = { $ne: new ObjectId(existingId) };
      }

      const existing = await db.collection('recipes').findOne(query);
      if (!existing) {
        exists = false;
      } else {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    return slug;
  }

  async optimizeImage(imageBuffer, size) {
    return await sharp(imageBuffer)
      .resize(size.width, size.height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: 80,
        progressive: true,
        optimizeScans: true,
      })
      .withMetadata({
        exif: {
          IFD0: {
            Copyright: 'Rezepta',
            ImageDescription: 'Recipe image from Rezepta',
          },
        },
      })
      .toBuffer();
  }

  async processRecipeImages(images) {
    const processedImages = [];

    for (const image of images) {
      const dimensions = imageSize(image.buffer);
      const filename = slugify(image.originalname, { lower: true });
      const baseFilename = filename.replace(/\.[^/.]+$/, '');

      const variants = {};
      for (const [size, dimensions] of Object.entries(this.RECIPE_IMAGE_SIZES)) {
        const optimizedJpeg = await this.optimizeImage(image.buffer, dimensions);
        const optimizedWebp = await sharp(image.buffer)
          .resize(dimensions.width, dimensions.height, {
            fit: 'cover',
            position: 'center',
          })
          .webp({
            quality: 80,
            effort: 6,
          })
          .toBuffer();

        variants[size.toLowerCase()] = {
          jpeg: {
            url: `${baseFilename}-${size.toLowerCase()}.jpg`,
            width: dimensions.width,
            height: dimensions.height,
            size: optimizedJpeg.length,
          },
          webp: {
            url: `${baseFilename}-${size.toLowerCase()}.webp`,
            width: dimensions.width,
            height: dimensions.height,
            size: optimizedWebp.length,
          },
        };
      }

      const blurHash = await this.generateBlurHash(image.buffer);

      processedImages.push({
        original: {
          filename,
          width: dimensions.width,
          height: dimensions.height,
          size: image.size,
          blur_hash: blurHash,
        },
        variants,
        alt_text: image.alt_text || '',
        caption: image.caption || '',
      });
    }

    return processedImages;
  }

  async generateBlurHash(imageBuffer) {
    // Implementation would depend on the blur hash library used
    // This is a placeholder for the actual implementation
    return 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
  }

  generateMetaTags(recipe) {
    const title = recipe.seo_title || recipe.title;
    const description = recipe.seo_description || this.generateDescription(recipe);
    const keywords = recipe.seo_keywords || this.generateKeywords(recipe);
    const mainImage = recipe.images[0]?.variants?.large?.jpeg?.url;
    const webpImage = recipe.images[0]?.variants?.large?.webp?.url;

    const metaTags = {
      title: `${title} | Rezepta`,
      description,
      keywords: keywords.join(', '),
      og: {
        title,
        description,
        type: 'article',
        image: mainImage,
        url: `https://rezepta.com/recipes/${recipe.slug}`,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        image: mainImage,
      },
      article: {
        published_time: recipe.created_at.toISOString(),
        modified_time: recipe.updated_at.toISOString(),
        author: recipe.author.name,
        section: recipe.category,
        tag: keywords,
      },
    };

    if (webpImage) {
      metaTags.og.image = [
        {
          url: mainImage,
          type: 'image/jpeg',
        },
        {
          url: webpImage,
          type: 'image/webp',
        },
      ];
    }

    return metaTags;
  }

  generateDescription(recipe) {
    const ingredients = recipe.ingredients
      .slice(0, 3)
      .map(i => i.name)
      .join(', ');
    return `${recipe.title} - A delicious recipe featuring ${ingredients} and more. ${recipe.description || ''}`.slice(
      0,
      160
    );
  }

  generateKeywords(recipe) {
    const keywords = new Set();

    // Add cuisine type
    if (recipe.cuisine) keywords.add(recipe.cuisine.toLowerCase());

    // Add cooking method
    if (recipe.cooking_method) keywords.add(recipe.cooking_method.toLowerCase());

    // Add main ingredients
    recipe.ingredients.forEach(ingredient => {
      keywords.add(ingredient.name.toLowerCase());
    });

    // Add dietary preferences
    if (recipe.dietary_preferences) {
      recipe.dietary_preferences.forEach(pref => {
        keywords.add(pref.toLowerCase());
      });
    }

    return Array.from(keywords).slice(0, 10);
  }

  generateSchemaMarkup(recipe) {
    const mainImage = recipe.images[0]?.variants?.large?.jpeg?.url;
    const webpImage = recipe.images[0]?.variants?.large?.webp?.url;
    const images = [mainImage];
    if (webpImage) images.push(webpImage);

    const schema = {
      '@context': 'https://schema.org/',
      '@type': 'Recipe',
      name: recipe.title,
      image: images,
      description: recipe.description,
      keywords: recipe.seo_keywords?.join(', '),
      author: {
        '@type': 'Person',
        name: recipe.author.name,
      },
      datePublished: recipe.created_at.toISOString(),
      dateModified: recipe.updated_at.toISOString(),
      prepTime: `PT${recipe.prep_time}M`,
      cookTime: `PT${recipe.cooking_time}M`,
      totalTime: `PT${recipe.prep_time + recipe.cooking_time}M`,
      recipeCategory: recipe.category,
      recipeCuisine: recipe.cuisine,
      recipeYield: recipe.servings,
      nutrition: recipe.nutrition
        ? {
            '@type': 'NutritionInformation',
            calories: `${recipe.nutrition.calories} calories`,
            fatContent: `${recipe.nutrition.fat}g`,
            proteinContent: `${recipe.nutrition.protein}g`,
            carbohydrateContent: `${recipe.nutrition.carbs}g`,
          }
        : undefined,
      recipeIngredient: recipe.ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`),
      recipeInstructions: recipe.instructions.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        text: step,
        image: recipe.images[index]?.variants?.medium?.jpeg?.url,
      })),
      aggregateRating: recipe.ratings
        ? {
            '@type': 'AggregateRating',
            ratingValue: recipe.ratings.average,
            ratingCount: recipe.ratings.count,
            bestRating: '5',
            worstRating: '1',
          }
        : undefined,
      video: recipe.video
        ? {
            '@type': 'VideoObject',
            name: `How to make ${recipe.title}`,
            description: `Learn how to make ${recipe.title} step by step`,
            thumbnailUrl: recipe.video.thumbnail_url,
            contentUrl: recipe.video.url,
            uploadDate: recipe.video.uploaded_at.toISOString(),
            duration: `PT${recipe.video.duration_seconds}S`,
          }
        : undefined,
    };

    if (recipe.reviews?.length > 0) {
      schema.review = recipe.reviews.map(review => ({
        '@type': 'Review',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: review.rating,
          bestRating: '5',
          worstRating: '1',
        },
        author: {
          '@type': 'Person',
          name: review.author.name,
        },
        datePublished: review.created_at.toISOString(),
        reviewBody: review.text,
      }));
    }

    return schema;
  }

  async updateRecipeSeo(recipeId, seoData) {
    const db = getDb();
    const updates = {};

    if (seoData.title) {
      updates.seo_title = seoData.title;
      updates.slug = await this.generateUniqueSlug(seoData.title, recipeId);
    }

    if (seoData.description) {
      updates.seo_description = seoData.description;
    }

    if (seoData.keywords) {
      updates.seo_keywords = seoData.keywords;
    }

    if (seoData.images) {
      for (let i = 0; i < seoData.images.length; i++) {
        const imageUpdate = seoData.images[i];
        updates[`images.${i}.alt_text`] = imageUpdate.alt_text;
        updates[`images.${i}.caption`] = imageUpdate.caption;
      }
    }

    await db.collection('recipes').updateOne({ _id: new ObjectId(recipeId) }, { $set: updates });

    return await db.collection('recipes').findOne({ _id: new ObjectId(recipeId) });
  }

  async getCanonicalUrl(recipe) {
    // If this recipe is a remix, return the original recipe's URL
    if (recipe.original_recipe_id) {
      const originalRecipe = await getDb()
        .collection('recipes')
        .findOne({ _id: new ObjectId(recipe.original_recipe_id) });
      if (originalRecipe) {
        return `https://rezepta.com/recipes/${originalRecipe.slug}`;
      }
    }

    return `https://rezepta.com/recipes/${recipe.slug}`;
  }
}

module.exports = new RecipeSeoService();
