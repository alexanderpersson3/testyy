import { PDFDocument } from 'pdf-lib';;
;
;
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';;;;
import { DatabaseService } from '../db/database.service.js';;
import type { RecipeCollection, CollectionVisibility, CollectionRecipe, CollectionCollaborator, CollectionStats, CollectionSettings, CollectionFilters, CreateCollectionRequest, UpdateCollectionRequest, AddRecipeRequest, UpdateRecipeRequest, AddCollaboratorRequest, CollectionShareResult, CollectionExportOptions, CollectionImportResult, CollectionAnalytics } from '../types/express.js';
import {  } from '../types/collections.js';;
import type { Recipe } from '../types/express.js';
import { User } from '../types/user.js';;

interface CollectionShare {
  collectionId: ObjectId;
  accessCode: string;
  expiresAt?: Date;
  createdAt: Date;
  createdBy: ObjectId;
}

export class CollectionsService {
  private readonly defaultSettings: CollectionSettings = {
    sortBy: 'created',
    sortDirection: 'desc',
    defaultView: 'grid',
    showNotes: true,
    showRatings: true,
    showCookingHistory: true,
    enableNotifications: true,
    autoAddToGroceryList: false,
  };

  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Create a new collection
   */
  async createCollection(
    userId: string,
    request: CreateCollectionRequest
  ): Promise<RecipeCollection> {
    const collection: RecipeCollection = {
      userId: new ObjectId(userId),
      name: request.name,
      description: request.description,
      visibility: request.visibility,
      thumbnail: request.thumbnail,
      tags: request.tags || [],
      recipes: [],
      stats: {
        recipeCount: 0,
        viewCount: 0,
        saveCount: 0,
        shareCount: 0,
        popularTags: [],
      },
      settings: {
        ...this.defaultSettings,
        ...request.settings,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db
      .getCollection<RecipeCollection>('collections')
      .insertOne(collection);
    return { ...collection, _id: result.insertedId };
  }

  /**
   * Update a collection
   */
  async updateCollection(
    userId: string,
    collectionId: string,
    updates: UpdateCollectionRequest
  ): Promise<RecipeCollection> {
    const updatedSettings = updates.settings
      ? { ...this.defaultSettings, ...updates.settings }
      : undefined;

    const updatedCollection: Partial<RecipeCollection> = {
      ...(updates.name && { name: updates.name }),
      ...(updates.description && { description: updates.description }),
      ...(updates.visibility && { visibility: updates.visibility }),
      ...(updates.thumbnail && { thumbnail: updates.thumbnail }),
      ...(updates.tags && { tags: updates.tags }),
      ...(updatedSettings && { settings: updatedSettings }),
      updatedAt: new Date(),
    };

    const result = await this.db
      .getCollection<RecipeCollection>('collections')
      .findOneAndUpdate(
        { _id: new ObjectId(collectionId), userId: new ObjectId(userId) },
        { $set: updatedCollection },
        { returnDocument: 'after' }
      );

    if (!result.value) {
      throw new Error('Collection not found or unauthorized');
    }

    return result.value;
  }

  /**
   * Delete a collection
   */
  async deleteCollection(userId: string, collectionId: string): Promise<void> {
    const result = await this.db.getCollection<RecipeCollection>('collections').deleteOne({
      _id: new ObjectId(collectionId),
      userId: new ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new Error('Collection not found or unauthorized');
    }
  }

  /**
   * Get collections
   */
  async getCollections(userId: string, filters?: CollectionFilters): Promise<RecipeCollection[]> {
    const query: any = {
      $or: [
        { userId: new ObjectId(userId) },
        { 'collaborators.userId': new ObjectId(userId) },
        { visibility: 'public' },
      ],
    };

    if (filters) {
      if (filters.visibility?.length) {
        query.visibility = { $in: filters.visibility };
      }
      if (filters.tags?.length) {
        query.tags = { $all: filters.tags };
      }
      if (filters.hasRecipe) {
        query['recipes.recipeId'] = new ObjectId(filters.hasRecipe);
      }
      if (filters.minRecipes !== undefined) {
        query['stats.recipeCount'] = { $gte: filters.minRecipes };
      }
      if (filters.maxRecipes !== undefined) {
        query['stats.recipeCount'] = { ...query['stats.recipeCount'], $lte: filters.maxRecipes };
      }
      if (filters.rating !== undefined) {
        query['stats.averageRating'] = { $gte: filters.rating };
      }
      if (filters.updatedSince) {
        query.updatedAt = { $gte: filters.updatedSince };
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } },
        ];
      }
    }

    return this.db
      .getCollection<RecipeCollection>('collections')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * Add recipe to collection
   */
  async addRecipe(
    userId: string,
    collectionId: string,
    request: AddRecipeRequest
  ): Promise<CollectionRecipe> {
    // Verify collection access
    const collection = await this.verifyCollectionAccess(userId, collectionId, ['editor', 'admin']);

    // Verify recipe exists
    const recipe = await this.db.getCollection<Recipe>('recipes').findOne({
      _id: new ObjectId(request.recipeId),
    });
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Create recipe entry
    const recipeEntry: CollectionRecipe = {
      recipeId: new ObjectId(request.recipeId),
      addedAt: new Date(),
      position: request.position || collection.recipes.length,
      notes: request.notes,
      tags: request.tags,
    };

    // Add recipe and update stats
    await this.db.getCollection<RecipeCollection>('collections').updateOne(
      { _id: new ObjectId(collectionId) },
      {
        $push: { recipes: recipeEntry },
        $inc: { 'stats.recipeCount': 1 },
        $set: { updatedAt: new Date() },
      }
    );

    return recipeEntry;
  }

  /**
   * Update recipe in collection
   */
  async updateRecipe(
    userId: string,
    collectionId: string,
    recipeId: string,
    updates: UpdateRecipeRequest
  ): Promise<CollectionRecipe> {
    // Verify collection access
    await this.verifyCollectionAccess(userId, collectionId, ['editor', 'admin']);

    // Update recipe
    const result = await this.db.getCollection<RecipeCollection>('collections').findOneAndUpdate(
      {
        _id: new ObjectId(collectionId),
        'recipes.recipeId': new ObjectId(recipeId),
      },
      {
        $set: {
          'recipes.$.position': updates.position,
          'recipes.$.notes': updates.notes,
          'recipes.$.tags': updates.tags,
          'recipes.$.rating': updates.rating,
          'recipes.$.isFavorite': updates.isFavorite,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new Error('Recipe not found in collection');
    }

    const updatedRecipe = result.value.recipes.find(
      (r: CollectionRecipe) => r.recipeId.toString() === recipeId
    );

    if (!updatedRecipe) {
      throw new Error('Failed to update recipe');
    }

    return updatedRecipe;
  }

  /**
   * Remove recipe from collection
   */
  async removeRecipe(userId: string, collectionId: string, recipeId: string): Promise<void> {
    // Verify collection access
    await this.verifyCollectionAccess(userId, collectionId, ['editor', 'admin']);

    // Remove recipe and update stats
    const result = await this.db.getCollection<RecipeCollection>('collections').updateOne(
      { _id: new ObjectId(collectionId) },
      {
        $pull: { recipes: { recipeId: new ObjectId(recipeId) } },
        $inc: { 'stats.recipeCount': -1 },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Recipe not found in collection');
    }
  }

  /**
   * Add collaborator to collection
   */
  async addCollaborator(
    userId: string,
    collectionId: string,
    request: AddCollaboratorRequest
  ): Promise<CollectionCollaborator> {
    // Verify collection access
    await this.verifyCollectionAccess(userId, collectionId, ['admin']);

    // Verify user exists
    const user = await this.db.getCollection<User>('users').findOne({
      _id: new ObjectId(request.userId),
    });
    if (!user) {
      throw new Error('User not found');
    }

    // Create collaborator entry
    const collaborator: CollectionCollaborator = {
      userId: new ObjectId(request.userId),
      role: request.role,
      addedAt: new Date(),
      addedBy: new ObjectId(userId),
    };

    // Add collaborator
    await this.db.getCollection<RecipeCollection>('collections').updateOne(
      { _id: new ObjectId(collectionId) },
      {
        $push: { collaborators: collaborator },
        $set: { updatedAt: new Date() },
      }
    );

    return collaborator;
  }

  /**
   * Remove collaborator from collection
   */
  async removeCollaborator(
    userId: string,
    collectionId: string,
    collaboratorId: string
  ): Promise<void> {
    // Verify collection access
    await this.verifyCollectionAccess(userId, collectionId, ['admin']);

    // Remove collaborator
    const result = await this.db.getCollection<RecipeCollection>('collections').updateOne(
      { _id: new ObjectId(collectionId) },
      {
        $pull: { collaborators: { userId: new ObjectId(collaboratorId) } },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Collaborator not found');
    }
  }

  /**
   * Share collection
   */
  async shareCollection(
    userId: string,
    collectionId: string,
    expiresIn?: number
  ): Promise<CollectionShareResult> {
    // Verify collection access
    const collection = await this.verifyCollectionAccess(userId, collectionId, ['editor', 'admin']);

    // Generate share URL and access code
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const shareUrl = `${process.env.APP_URL}/collections/shared/${collectionId}?code=${accessCode}`;

    // Create share record
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : undefined;
    await this.db.getCollection<CollectionShare>('collection_shares').insertOne({
      collectionId: new ObjectId(collectionId),
      accessCode,
      expiresAt,
      createdAt: new Date(),
      createdBy: new ObjectId(userId),
    });

    // Update collection stats
    await this.db.getCollection<RecipeCollection>('collections').updateOne(
      { _id: new ObjectId(collectionId) },
      {
        $inc: { 'stats.shareCount': 1 },
        $set: { updatedAt: new Date() },
      }
    );

    return {
      url: shareUrl,
      expiresAt,
      accessCode,
    };
  }

  /**
   * Export collection
   */
  async exportCollection(
    userId: string,
    collectionId: string,
    options: CollectionExportOptions
  ): Promise<Buffer> {
    // Verify collection access
    const collection = await this.verifyCollectionAccess(userId, collectionId);

    // Get recipes
    const recipeIds = collection.recipes.map((c: CollectionRecipe) => c.recipeId);
    const recipes = await this.db
      .getCollection<Recipe>('recipes')
      .find({ _id: { $in: recipeIds } })
      .toArray();

    // Generate export based on format
    switch (options.format) {
      case 'json':
        return this.generateJsonExport(collection, recipes, options);
      case 'pdf':
        return this.generatePdfExport(collection, recipes, options);
      case 'csv':
        return this.generateCsvExport(collection, recipes, options);
      case 'markdown':
        return this.generateMarkdownExport(collection, recipes, options);
      default:
        throw new Error('Unsupported export format');
    }
  }

  /**
   * Import collection
   */
  async importCollection(
    userId: string,
    file: Buffer,
    format: string
  ): Promise<CollectionImportResult> {
    try {
      // Parse import file based on format
      const importData = await this.parseImportFile(file, format);

      // Create collection
      const collection = await this.createCollection(userId, {
        name: importData.name,
        description: importData.description,
        visibility: 'private',
        tags: importData.tags,
      });

      // Import recipes
      const errors: { recipe: string; error: string }[] = [];
      let recipesImported = 0;

      for (const recipe of importData.recipes) {
        try {
          await this.addRecipe(userId, collection._id!.toString(), {
            recipeId: recipe.id,
            notes: recipe.notes,
            tags: recipe.tags,
          });
          recipesImported++;
        } catch (error: any) {
          errors.push({
            recipe: recipe.name,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        collectionId: collection._id!.toString(),
        recipesImported,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        recipesImported: 0,
        errors: [
          {
            recipe: 'Import file',
            error: error.message,
          },
        ],
      };
    }
  }

  /**
   * Get collection analytics
   */
  async getAnalytics(userId: string, collectionId: string): Promise<CollectionAnalytics> {
    // Verify collection access
    await this.verifyCollectionAccess(userId, collectionId);

    // Get analytics data
    const analytics = await this.db
      .getCollection<CollectionAnalytics>('collection_analytics')
      .findOne({
        collectionId: new ObjectId(collectionId),
      });

    if (!analytics) {
      throw new Error('Analytics not found');
    }

    return analytics;
  }

  /**
   * Helper: Verify collection access
   */
  private async verifyCollectionAccess(
    userId: string,
    collectionId: string,
    requiredRoles?: ('viewer' | 'editor' | 'admin')[]
  ): Promise<RecipeCollection> {
    const collection = await this.db.getCollection<RecipeCollection>('collections').findOne({
      _id: new ObjectId(collectionId),
    });

    if (!collection) {
      throw new Error('Collection not found');
    }

    // Check ownership
    if (collection.userId.toString() === userId) {
      return collection;
    }

    // Check collaborator access
    const collaborator = collection.collaborators?.find(
      (c: CollectionCollaborator) => c.userId.toString() === userId
    );

    if (!collaborator) {
      // Check public access
      if (
        collection.visibility === 'public' &&
        (!requiredRoles || requiredRoles.includes('viewer'))
      ) {
        return collection;
      }
      throw new Error('Unauthorized access');
    }

    // Verify role
    if (requiredRoles && !requiredRoles.includes(collaborator.role)) {
      throw new Error('Insufficient permissions');
    }

    return collection;
  }

  /**
   * Helper: Generate exports
   */
  private generateJsonExport(
    collection: RecipeCollection,
    recipes: Recipe[],
    options: CollectionExportOptions
  ): Buffer {
    const exportData = {
      name: collection.name,
      description: collection.description,
      tags: collection.tags,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      recipes: recipes.map(recipe => {
        const collectionRecipe = collection.recipes.find(
          (cr: CollectionRecipe) => cr.recipeId.toString() === recipe._id?.toString()
        );

        return {
          id: recipe._id?.toString(),
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          ...(options.includeNotes && collectionRecipe?.notes && { notes: collectionRecipe.notes }),
          ...(options.includeRatings &&
            collectionRecipe?.rating && { rating: collectionRecipe.rating }),
          ...(options.includeCookingHistory && {
            lastCooked: collectionRecipe?.lastCooked,
            timesCooked: collectionRecipe?.timesCooked,
          }),
        };
      }),
    };

    return Buffer.from(JSON.stringify(exportData, null, 2));
  }

  private generatePdfExport(
    collection: RecipeCollection,
    recipes: Recipe[],
    options: CollectionExportOptions
  ): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Title and description
    doc.fontSize(24).text(collection.name);
    if (collection.description) {
      doc.fontSize(12).text(collection.description);
    }
    doc.moveDown();

    // Recipes
    for (const recipe of recipes) {
      const collectionRecipe = collection.recipes.find(
        (cr: CollectionRecipe) => cr.recipeId.toString() === recipe._id?.toString()
      );

      doc.fontSize(18).text(recipe.title);
      if (recipe.description) {
        doc.fontSize(12).text(recipe.description);
      }
      doc.moveDown();

      // Ingredients
      doc.fontSize(14).text('Ingredients:');
      recipe.ingredients.forEach((ingredient: any) => {
        doc.fontSize(12).text(`• ${ingredient.amount} ${ingredient.unit} ${ingredient.name}`);
      });
      doc.moveDown();

      // Instructions
      doc.fontSize(14).text('Instructions:');
      recipe.instructions.forEach((instruction: any, index: number) => {
        doc.fontSize(12).text(`${index + 1}. ${instruction.text}`);
      });
      doc.moveDown();

      // Optional sections based on options
      if (options.includeNotes && collectionRecipe?.notes) {
        doc.fontSize(14).text('Notes:');
        doc.fontSize(12).text(collectionRecipe.notes);
        doc.moveDown();
      }

      if (options.includeRatings && collectionRecipe?.rating) {
        doc.fontSize(14).text(`Rating: ${collectionRecipe.rating}/5`);
        doc.moveDown();
      }

      if (options.includeCookingHistory && collectionRecipe?.lastCooked) {
        doc.fontSize(14).text('Cooking History:');
        doc.fontSize(12).text(`Last cooked: ${collectionRecipe.lastCooked.toLocaleDateString()}`);
        if (collectionRecipe.timesCooked) {
          doc.fontSize(12).text(`Times cooked: ${collectionRecipe.timesCooked}`);
        }
        doc.moveDown();
      }

      doc.addPage();
    }

    return new Promise(resolve => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.end();
    });
  }

  private generateCsvExport(
    collection: RecipeCollection,
    recipes: any[],
    options: CollectionExportOptions
  ): Buffer {
    const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;

    const headers = [
      { id: 'title', title: 'Title' },
      { id: 'description', title: 'Description' },
      { id: 'ingredients', title: 'Ingredients' },
      { id: 'instructions', title: 'Instructions' },
    ];

    if (options.includeNotes) headers.push({ id: 'notes', title: 'Notes' });
    if (options.includeRatings) headers.push({ id: 'rating', title: 'Rating' });
    if (options.includeCookingHistory) {
      headers.push(
        { id: 'lastCooked', title: 'Last Cooked' },
        { id: 'timesCooked', title: 'Times Cooked' }
      );
    }

    const csvStringifier = createCsvStringifier({ header: headers });

    const records = recipes.map(recipe => {
      const collectionRecipe = collection.recipes.find(
        cr => cr.recipeId.toString() === recipe._id.toString()
      );

      return {
        title: recipe.title,
        description: recipe.description || '',
        ingredients: recipe.ingredients
          .map((i: any) => `${i.amount} ${i.unit} ${i.name}`)
          .join('; '),
        instructions: recipe.instructions
          .map((i: any, idx: number) => `${idx + 1}. ${i.text}`)
          .join('; '),
        ...(options.includeNotes && { notes: collectionRecipe?.notes || '' }),
        ...(options.includeRatings && { rating: collectionRecipe?.rating || '' }),
        ...(options.includeCookingHistory && {
          lastCooked: collectionRecipe?.lastCooked?.toLocaleDateString() || '',
          timesCooked: collectionRecipe?.timesCooked || '',
        }),
      };
    });

    const header = csvStringifier.getHeaderString();
    const data = csvStringifier.stringifyRecords(records);
    return Buffer.from(header + data);
  }

  private generateMarkdownExport(
    collection: RecipeCollection,
    recipes: any[],
    options: CollectionExportOptions
  ): Buffer {
    let markdown = `# ${collection.name}\n\n`;

    if (collection.description) {
      markdown += `${collection.description}\n\n`;
    }

    if (collection.tags.length > 0) {
      markdown += `Tags: ${collection.tags.join(', ')}\n\n`;
    }

    markdown += `## Recipes\n\n`;

    for (const recipe of recipes) {
      const collectionRecipe = collection.recipes.find(
        cr => cr.recipeId.toString() === recipe._id.toString()
      );

      markdown += `### ${recipe.title}\n\n`;

      if (recipe.description) {
        markdown += `${recipe.description}\n\n`;
      }

      markdown += `#### Ingredients\n\n`;
      recipe.ingredients.forEach((ingredient: any) => {
        markdown += `- ${ingredient.amount} ${ingredient.unit} ${ingredient.name}\n`;
      });
      markdown += '\n';

      markdown += `#### Instructions\n\n`;
      recipe.instructions.forEach((instruction: any, index: number) => {
        markdown += `${index + 1}. ${instruction.text}\n`;
      });
      markdown += '\n';

      if (options.includeNotes && collectionRecipe?.notes) {
        markdown += `#### Notes\n\n${collectionRecipe.notes}\n\n`;
      }

      if (options.includeRatings && collectionRecipe?.rating) {
        markdown += `#### Rating: ${collectionRecipe.rating}/5\n\n`;
      }

      if (options.includeCookingHistory && collectionRecipe?.lastCooked) {
        markdown += `#### Cooking History\n\n`;
        markdown += `- Last cooked: ${collectionRecipe.lastCooked.toLocaleDateString()}\n`;
        if (collectionRecipe.timesCooked) {
          markdown += `- Times cooked: ${collectionRecipe.timesCooked}\n`;
        }
        markdown += '\n';
      }

      markdown += '---\n\n';
    }

    return Buffer.from(markdown);
  }

  /**
   * Helper: Parse imports
   */
  private async parseImportFile(
    file: Buffer,
    format: string
  ): Promise<{
    name: string;
    description?: string;
    tags?: string[];
    recipes: Array<{
      id: string;
      name: string;
      notes?: string;
      tags?: string[];
    }>;
  }> {
    switch (format) {
      case 'json':
        try {
          const data = JSON.parse(file.toString());
          return {
            name: data.name,
            description: data.description,
            tags: data.tags,
            recipes: data.recipes.map((recipe: any) => ({
              id: recipe.id,
              name: recipe.title,
              notes: recipe.notes,
              tags: recipe.tags,
            })),
          };
        } catch (error) {
          throw new Error('Invalid JSON format');
        }

      case 'csv':
        const csv = require('csv-parse/sync');
        try {
          const records = csv.parse(file.toString(), {
            columns: true,
            skip_empty_lines: true,
          });

          return {
            name: 'Imported Collection',
            description: 'Imported from CSV file',
            recipes: records.map((record: any) => ({
              id: record.id || new ObjectId().toString(),
              name: record.title || record.name,
              notes: record.notes,
              tags: record.tags ? record.tags.split(',').map((t: string) => t.trim()) : [],
            })),
          };
        } catch (error) {
          throw new Error('Invalid CSV format');
        }

      case 'markdown':
        const content = file.toString();
        const sections = content.split('---\n');

        // Parse header (first section)
        const headerMatch = sections[0].match(/# (.*?)\n\n(.*?)(?=\n\n|$)/s);
        if (!headerMatch) {
          throw new Error('Invalid markdown format: missing title');
        }

        const name = headerMatch[1];
        const description = headerMatch[2];

        // Parse recipes
        const recipes = sections.slice(1).map(section => {
          const titleMatch = section.match(/### (.*?)\n/);
          const notesMatch = section.match(/#### Notes\n\n(.*?)\n\n/s);
          const tagsMatch = section.match(/Tags: (.*?)\n/);

          if (!titleMatch) {
            throw new Error('Invalid markdown format: recipe missing title');
          }

          return {
            id: new ObjectId().toString(),
            name: titleMatch[1],
            notes: notesMatch ? notesMatch[1] : undefined,
            tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [],
          };
        });

        return {
          name,
          description,
          recipes,
        };

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }
}
