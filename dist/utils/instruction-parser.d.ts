import { TimerConfig } from '../types/timer.js';
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
/**
 * Parse instructions from various formats
 */
export declare function parseInstructions(instructions: string[]): ParsedInstruction[];
/**
 * Split instructions into steps
 */
export declare function splitInstructions(text: string): string[];
export {};
