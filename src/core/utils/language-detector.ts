import type { LanguageCode } from '../types/express.js';
import logger from '../utils/logger.js';

const SUPPORTED_LANGUAGES = new Set<LanguageCode>(['en', 'sv', 'no', 'da', 'fi']);
const DEFAULT_LANGUAGE: LanguageCode = 'en';
const MIN_TEXT_LENGTH = 10;
const MIN_CONFIDENCE = 0.5;

export interface DetectionResult {
  language: LanguageCode;
  confidence: number;
  isReliable: boolean;
}

export function detectLanguage(text: string): DetectionResult {
  if (!text || text.length < MIN_TEXT_LENGTH) {
    return {
      language: DEFAULT_LANGUAGE,
      confidence: 0,
      isReliable: false,
    };
  }

  try {
    // Simple language detection based on character frequency
    const langScores = new Map<LanguageCode, number>();

    // Initialize scores
    SUPPORTED_LANGUAGES.forEach(lang => langScores.set(lang, 0));

    // Count character frequencies
    const charFreq = getCharacterFrequencies(text.toLowerCase());

    // Compare with language patterns
    SUPPORTED_LANGUAGES.forEach(lang => {
      const score = calculateLanguageScore(charFreq, lang);
      langScores.set(lang, score);
    });

    // Find language with highest score
    let maxScore = 0;
    let detectedLang = DEFAULT_LANGUAGE;

    langScores.forEach((score: any, lang: any) => {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    });

    const confidence = maxScore / text.length;
    const isReliable = confidence >= MIN_CONFIDENCE;

    return {
      language: detectedLang,
      confidence,
      isReliable,
    };
  } catch (error) {
    logger.error('Language detection failed:', error);
    return {
      language: DEFAULT_LANGUAGE,
      confidence: 0,
      isReliable: false,
    };
  }
}

function getCharacterFrequencies(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const char of text) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }
  return freq;
}

function calculateLanguageScore(charFreq: Map<string, number>, lang: LanguageCode): number {
  // Language-specific character patterns for supported languages only
  const patterns: Partial<Record<LanguageCode, string[]>> = {
    en: ['th', 'he', 'an', 'in', 'er'],
    sv: ['en', 'et', 'ar', 'er', 'på'],
    no: ['en', 'et', 'er', 'på', 'og'],
    da: ['en', 'et', 'er', 'på', 'og'],
    fi: ['en', 'in', 'on', 'ta', 'sa'],
  };

  const langPatterns = patterns[lang];
  if (!langPatterns) {
    return 0;
  }

  let score = 0;
  langPatterns.forEach(pattern => {
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i]!;
      score += charFreq.get(char) || 0;
    }
  });

  return score;
}

export function isLanguageSupported(language: string): language is LanguageCode {
  return SUPPORTED_LANGUAGES.has(language as LanguageCode);
}
