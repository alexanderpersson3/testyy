import { PDFDocument } from 'pdf-lib';;
import type { Recipe } from '../types/express.js';
;
import { rgb } from 'pdf-lib';;
export interface PDFGeneratorOptions {
  template?: string;
  includeImages?: boolean;
  includeNutrition?: boolean;
  includeMetadata?: boolean;
}

export async function generatePDF(
  recipes: Recipe[],
  options: PDFGeneratorOptions = {}
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  let yOffset = height - 50;

  for (const recipe of recipes) {
    // Title
    page.drawText(recipe.title, {
      x: 50,
      y: yOffset,
      size: 24,
      color: rgb(0, 0, 0),
    });
    yOffset -= 40;

    // Description
    if (recipe.description) {
      page.drawText(recipe.description, {
        x: 50,
        y: yOffset,
        size: 12,
        color: rgb(0, 0, 0),
      });
      yOffset -= 30;
    }

    // Metadata
    if (options.includeMetadata) {
      page.drawText(`Prep Time: ${recipe.prepTime} minutes`, {
        x: 50,
        y: yOffset,
        size: 12,
      });
      yOffset -= 20;

      page.drawText(`Cook Time: ${recipe.cookTime} minutes`, {
        x: 50,
        y: yOffset,
        size: 12,
      });
      yOffset -= 20;

      page.drawText(`Servings: ${recipe.servings}`, {
        x: 50,
        y: yOffset,
        size: 12,
      });
      yOffset -= 30;
    }

    // Ingredients
    page.drawText('Ingredients:', {
      x: 50,
      y: yOffset,
      size: 16,
    });
    yOffset -= 20;

    for (const ingredient of recipe.ingredients) {
      page.drawText(`• ${ingredient.amount} ${ingredient.unit} ${ingredient.name}`, {
        x: 70,
        y: yOffset,
        size: 12,
      });
      yOffset -= 20;
    }
    yOffset -= 10;

    // Instructions
    page.drawText('Instructions:', {
      x: 50,
      y: yOffset,
      size: 16,
    });
    yOffset -= 20;

    for (const instruction of recipe.instructions) {
      const text = `${instruction.step}. ${instruction.text}`;
      page.drawText(text, {
        x: 70,
        y: yOffset,
        size: 12,
      });
      yOffset -= 20;
    }

    // Add nutrition info if requested
    if (options.includeNutrition && recipe.nutritionalInfo) {
      yOffset -= 20;
      page.drawText('Nutritional Information:', {
        x: 50,
        y: yOffset,
        size: 16,
      });
      yOffset -= 20;

      const nutrition = recipe.nutritionalInfo;
      const nutritionText = [
        `Calories: ${nutrition.calories || 0}`,
        `Protein: ${nutrition.protein || 0}g`,
        `Carbohydrates: ${nutrition.carbohydrates || 0}g`,
        `Fat: ${nutrition.fat || 0}g`,
        `Fiber: ${nutrition.fiber || 0}g`,
      ];

      for (const text of nutritionText) {
        page.drawText(text, {
          x: 70,
          y: yOffset,
          size: 12,
        });
        yOffset -= 20;
      }
    }

    // Add page break if needed
    if (yOffset < 100) {
      page.drawText('(continued on next page)', {
        x: width / 2 - 60,
        y: 30,
        size: 10,
      });
      const newPage = pdfDoc.addPage();
      yOffset = height - 50;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
