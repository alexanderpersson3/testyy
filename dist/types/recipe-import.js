import { ObjectId } from 'mongodb';
;
import { PDFExtract as PDFExtractBase, PDFExtractText } from 'pdf.js-extract';
export function validateRecipeData(data) {
    return {
        title: data.title || 'Untitled Recipe',
        description: data.description || '',
        ingredients: data.sections.find(s => s.type === 'ingredients')?.content || [],
        instructions: data.sections.find(s => s.type === 'instructions')?.content || [],
        prepTime: data.metadata.prepTime || 0,
        cookTime: data.metadata.cookTime || 0,
        servings: data.metadata.servings || 2,
        difficulty: data.metadata.difficulty || 'medium',
        cuisine: data.metadata.cuisine || 'other',
        tags: data.metadata.tags || [],
        authorId: new ObjectId(), // This will be set by the route handler
        source: '', // This will be set by the route handler
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
export function extractRecipeData(text) {
    const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    const sections = [];
    let currentSection = { type: 'other', content: [] };
    let title;
    let description;
    // First non-empty line is usually the title
    if (lines.length > 0) {
        title = lines[0];
    }
    // Look for description in the next few lines
    for (let i = 1; i < Math.min(5, lines.length); i++) {
        if (lines[i].length > 20 &&
            !lines[i].toLowerCase().includes('ingredient') &&
            !lines[i].toLowerCase().includes('instruction')) {
            description = lines[i];
            break;
        }
    }
    // Process remaining lines into sections
    for (const line of lines.slice(1)) {
        if (line.toLowerCase().includes('ingredients')) {
            if (currentSection.content.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { type: 'ingredients', content: [] };
        }
        else if (line.toLowerCase().includes('instructions') ||
            line.toLowerCase().includes('directions') ||
            line.toLowerCase().includes('method')) {
            if (currentSection.content.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { type: 'instructions', content: [] };
        }
        else {
            currentSection.content.push(line);
        }
    }
    // Add the last section
    if (currentSection.content.length > 0) {
        sections.push(currentSection);
    }
    // Extract metadata
    const metadata = {
        prepTime: extractTime(text, 'prep'),
        cookTime: extractTime(text, 'cook'),
        servings: extractServings(text),
        difficulty: inferDifficulty(text),
        cuisine: inferCuisine(text),
        tags: extractTags(text),
    };
    return { title, description, sections, metadata };
}
function extractTime(text, type) {
    const regex = new RegExp(`${type}.*?time.*?(\\d+)\\s*(min|hour)`, 'i');
    const match = text.match(regex);
    if (!match)
        return 0;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return unit === 'hour' ? value * 60 : value;
}
function extractServings(text) {
    const regex = /serves?\s*(\d+)|(\d+)\s*servings?/i;
    const match = text.match(regex);
    return match ? parseInt(match[1] || match[2]) : 2;
}
function inferDifficulty(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('easy') ||
        lowerText.includes('simple') ||
        lowerText.includes('beginner')) {
        return 'easy';
    }
    if (lowerText.includes('hard') ||
        lowerText.includes('difficult') ||
        lowerText.includes('advanced')) {
        return 'hard';
    }
    return 'medium';
}
function inferCuisine(text) {
    const cuisines = [
        'italian',
        'french',
        'chinese',
        'japanese',
        'indian',
        'mexican',
        'thai',
        'mediterranean',
        'greek',
        'spanish',
        'korean',
        'vietnamese',
    ];
    const lowerText = text.toLowerCase();
    for (const cuisine of cuisines) {
        if (lowerText.includes(cuisine)) {
            return cuisine;
        }
    }
    return 'other';
}
function extractTags(text) {
    const commonTags = [
        'vegetarian',
        'vegan',
        'gluten-free',
        'dairy-free',
        'quick',
        'healthy',
        'dessert',
        'breakfast',
        'lunch',
        'dinner',
        'snack',
        'appetizer',
    ];
    const lowerText = text.toLowerCase();
    return commonTags.filter(tag => lowerText.includes(tag));
}
export { PDFExtractBase as PDFExtract };
//# sourceMappingURL=recipe-import.js.map