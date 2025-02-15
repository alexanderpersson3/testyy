import type { Recipe } from '../types/express.js';
import type { Timer, TimerAlert } from '../types/express.js';
import type { RecipeIngredient, RecipeInstruction } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { BaseDocument } from '../types/express.js';

interface MarkdownOptions {
  template?: string;
  imageStyle?: 'inline' | 'reference' | 'none';
  includeMetadataHeader?: boolean;
  includeMetadata?: boolean;
  includeNutrition?: boolean;
  includeTags?: boolean;
}

interface RecipeMetadata {
  preptime?: string;
  cooktime?: string;
  servings?: string;
  cuisine?: string;
  tags?: string;
  [key: string]: string | undefined;
}

interface RecipeInstructionSimple {
  step: number;
  text: string;
  duration?: number;
  temperature?: number;
}

export function parseMarkdown(markdown: string): Recipe[] {
  const recipes: Recipe[] = [];
  const sections = markdown.split(/(?=^# )/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const recipe = parseRecipeSection(section);
    if (recipe) {
      recipes.push(recipe);
    }
  }

  return recipes;
}

function parseRecipeSection(section: string): Recipe | null {
  try {
    const lines = section.split('\n');
    const title = lines[0]?.replace(/^#\s+/, '').trim() ?? '';

    let currentSection = '';
    let description = '';
    const ingredients: RecipeIngredient[] = [];
    const instructions: RecipeInstructionSimple[] = [];
    const metadata: RecipeMetadata = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      if (line.startsWith('## ')) {
        currentSection = line.replace(/^##\s+/, '').toLowerCase();
        continue;
      }

      switch (currentSection) {
        case 'description':
          description += line + '\n';
          break;
        case 'metadata':
          const [key, value] = line.split(':').map(s => s?.trim());
          if (key && value) {
            metadata[key.toLowerCase()] = value;
          }
          break;
        case 'ingredients':
          if (line.startsWith('- ')) {
            const ingredient = parseIngredient(line.substring(2));
            if (ingredient) {
              ingredients.push(ingredient);
            }
          }
          break;
        case 'instructions':
          if (line.startsWith('1. ') || /^\d+\.\s/.test(line)) {
            const instruction = parseInstruction(line);
            if (instruction) {
              instructions.push(instruction);
            }
          }
          break;
      }
    }

    const prepTime = parseInt(metadata.preptime || '0');
    const cookTime = parseInt(metadata.cooktime || '0');

    const recipe: Recipe & BaseDocument = {
      _id: new ObjectId(),
      title,
      description: description.trim(),
      prepTime,
      cookTime,
      totalTime: prepTime + cookTime,
      servings: parseInt(metadata.servings || '0'),
      ingredients,
      instructions: instructions.map(instr => ({
        step: instr.step,
        text: instr.text,
        duration: instr.duration,
        temperature: instr.temperature ? { value: instr.temperature, unit: 'C' } : undefined
      })),
      cuisine: metadata.cuisine || 'Other',
      tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : [],
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      difficulty: 'medium'  // Setting a default difficulty level
    };

    return recipe;

  } catch (error) {
    console.error('Failed to parse recipe section:', error);
    return null;
  }
}

function parseIngredient(line: string): RecipeIngredient | null {
  const match = line.match(/^([\d.\/]+)\s+(\w+)\s+(.+?)(?:\s*\((.*)\))?$/);
  if (!match) return null;

  const [, amount, unit, name, notes] = match;
  
  return {
    amount: parseAmount(amount ?? '0'),
    unit: unit ?? '',
    name: name ?? '',
    notes: notes ?? undefined
  };
}

function parseInstruction(line: string): RecipeInstructionSimple | null {
  const match = line.match(/^(\d+)\.\s+(.+)$/);
  if (!match) return null;

  const [, step, text] = match;
  
  const instruction: RecipeInstructionSimple = {
    step: parseInt(step ?? '0', 10),
    text: text?.trim() ?? ''
  };

  // Parse duration information if present
  const durationMatch = text?.match(/\[Duration:\s*(\d+)\s*minutes\]/i);
  if (durationMatch?.[1]) {
    instruction.duration = parseInt(durationMatch[1]);
  }

  // Parse temperature information if present
  const tempMatch = text?.match(/\[Temperature:\s*(\d+)\s*([CF])\]/i);
  if (tempMatch?.[1]) {
    const temp = parseInt(tempMatch[1]);
    instruction.temperature = tempMatch[2] === 'F' ? Math.round(((temp - 32) * 5) / 9) : temp;
  }

  return instruction;
}

function parseAmount(amount: string): number {
  if (amount.includes('/')) {
    const [num, denom] = amount.split('/').map(Number);
    if (num !== undefined && denom !== undefined && denom !== 0) {
      return num / denom;
    }
  }
  return parseFloat(amount) || 0;
}

export function generateMarkdown(recipes: Recipe[], options?: MarkdownOptions): string {
  let markdown = '';

  if (options?.includeMetadataHeader) {
    markdown += generateMetadataHeader(recipes);
  }

  recipes.forEach((recipe: any, index: any) => {
    if (index > 0) markdown += '\n\n';
    markdown += generateRecipeMarkdown(recipe, options);
  });

  return markdown;
}

function generateMetadataHeader(recipes: Recipe[]): string {
  return `---
Generated: ${new Date().toISOString()}
Total Recipes: ${recipes.length}
---

`;
}

function generateRecipeMarkdown(recipe: Recipe, options?: MarkdownOptions): string {
  let markdown = `# ${recipe.title}\n\n`;

  if (recipe.description) {
    markdown += `## Description\n\n${recipe.description}\n\n`;
  }

  markdown += `## Metadata\n\n`;
  markdown += `Prep Time: ${recipe.prepTime} minutes\n`;
  markdown += `Cook Time: ${recipe.cookTime} minutes\n`;
  markdown += `Servings: ${recipe.servings}\n\n`;

  markdown += `## Ingredients\n\n`;
  recipe.ingredients.forEach(ing => {
    markdown += `- ${ing.amount} ${ing.unit} ${ing.name}`;
    if (ing.notes) markdown += ` (${ing.notes})`;
    markdown += '\n';
  });
  markdown += '\n';

  markdown += `## Instructions\n\n`;
  recipe.instructions.forEach(instruction => {
    markdown += `${instruction.step}. ${instruction.text}`;

    if (instruction.duration) {
      markdown += ` [Duration: ${instruction.duration} minutes]`;
    }

    if (instruction.temperature) {
      markdown += ` [Temperature: ${instruction.temperature}°C]`;
    }

    markdown += '\n';
  });

  return markdown;
}

export function parseTimer(text: string): Timer | null {
  const match = text.match(/(\d+)\s*(minutes?|hours?)/i);
  if (!match) return null;

  const duration = parseInt(match[1] ?? '0', 10);
  const unit = match[2]?.toLowerCase().startsWith('hour') ? 'hours' : 'minutes';

  const timer: Timer = {
    userId: new ObjectId(),
    name: text,
    label: text,
    duration,
    unit: unit as "minutes" | "hours",
    status: "pending",
    alerts: [] as TimerAlert[],
    priority: "medium"
  };

  return timer;
}
