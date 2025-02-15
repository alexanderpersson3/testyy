import { TimerConfig, TimerUnit, TimerAlert } from '../types/timer.js';;

interface ParsedInstruction {
  step: number;
  text: string;
  image?: string;
  timer?: TimerConfig;
  parallelTimer?: TimerConfig;
  temperature?: {
    value: number;
    unit: 'C' | 'F';
  };
}

interface TimerMatch {
  duration: number;
  unit: 'minutes' | 'hours';
}

const TIME_PATTERNS = [
  // Explicit timer patterns
  /(?:set timer for|timer:|cook for|bake for)\s*(\d+)\s*(minutes?|hours?)/i,
  /(?:set timer for|timer:|cook for|bake for)\s*(\d+)\s*(?:hr|min)/i,

  // Duration patterns
  /for\s*(\d+)\s*(minutes?|hours?)/i,
  /(\d+)\s*(?:minutes?|hours?)\s*(?:or until|until)/i,
  /about\s*(\d+)\s*(minutes?|hours?)/i,

  // Range patterns
  /(\d+)-(\d+)\s*(minutes?|hours?)/i,
  /between\s*(\d+)\s*and\s*(\d+)\s*(minutes?|hours?)/i,
];

const PARALLEL_MARKERS = [
  'meanwhile',
  'at the same time',
  'in the meantime',
  'while',
  'during this time',
  'simultaneously',
];

/**
 * Parse instructions from various formats
 */
export function parseInstructions(instructions: string[]): ParsedInstruction[] {
  return instructions
    .map((instruction: any, index: any) => parseInstruction(instruction, index + 1))
    .filter((inst): inst is ParsedInstruction => inst !== null);
}

/**
 * Parse a single instruction
 */
function parseInstruction(instruction: string, stepNumber: number): ParsedInstruction | null {
  try {
    // Clean up the input
    const cleaned = instruction
      .trim()
      .replace(/^\d+\.\s*/, '') // Remove leading numbers
      .replace(/\s+/g, ' '); // Normalize whitespace

    if (!cleaned) return null;

    const result: ParsedInstruction = {
      step: stepNumber,
      text: cleaned,
    };

    // Extract temperature
    const tempMatch = cleaned.match(/(\d+)\s*[°]?(C|F)\b/i);
    if (tempMatch) {
      result.temperature = {
        value: parseInt(tempMatch[1], 10),
        unit: tempMatch[2].toUpperCase() as 'C' | 'F',
      };
    }

    // Extract timer
    const timeMatch = cleaned.match(/(\d+)\s*(minutes?|hours?)/i);
    if (timeMatch) {
      const duration = parseInt(timeMatch[1], 10);
      const unit = timeMatch[2].toLowerCase().startsWith('hour') ? 'hours' : 'minutes';
      result.timer = {
        duration,
        unit,
        alerts: [
          createTimerAlert(duration, 'Timer complete!'),
        ],
        priority: 'medium' // Default priority
      };
    }

    // Extract image URL if present
    const imageMatch = cleaned.match(/\[image:\s*([^\]]+)\]/i);
    if (imageMatch) {
      result.image = imageMatch[1].trim();
      result.text = result.text.replace(imageMatch[0], '').trim();
    }

    return result;
  } catch (error) {
    console.warn('Failed to parse instruction:', instruction, error);
    return null;
  }
}

/**
 * Check if instruction is a parallel step
 */
function isParallelStep(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PARALLEL_MARKERS.some(marker => lowerText.includes(marker));
}

/**
 * Normalize time unit
 */
function normalizeTimeUnit(unit: string): 'minutes' | 'hours' {
  unit = unit.toLowerCase();
  if (unit.startsWith('hour') || unit === 'hr') {
    return 'hours';
  }
  return 'minutes';
}

/**
 * Split instructions into steps
 */
export function splitInstructions(text: string): string[] {
  // Split on common step patterns
  const steps = text
    .split(/(?:\r?\n)|(?:\d+\.\s+)/g)
    .map(step => step.trim())
    .filter(step => step.length > 0);

  if (steps.length === 1) {
    // If no clear steps found, try to split on sentences
    return text
      .split(/[.!?]+/)
      .map(step => step.trim())
      .filter(step => step.length > 0);
  }

  return steps;
}

/**
 * Clean instruction text
 */
function cleanInstructionText(text: string): string {
  return text
    .replace(/^\d+\.\s*/, '') // Remove leading numbers
    .replace(/\[.*?\]/g, '') // Remove bracketed content
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
    .trim();
}

function createTimerAlert(time: number, message: string): TimerAlert {
  return {
    type: 'notification',
    time,
    message,
    sent: false
  };
}
