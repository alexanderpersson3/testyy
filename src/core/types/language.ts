import { ObjectId } from 'mongodb';;;;
export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'sv'
  | 'no'
  | 'da'
  | 'fi';

export interface TranslationMetadata {
  translatedBy: ObjectId;
  translatedAt: Date;
  lastUpdated: Date;
  status: 'pending' | 'approved' | 'rejected';
  confidence: number;
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  isAutomatic?: boolean;
}

export interface Translation {
  _id?: ObjectId;
  recipeId: ObjectId;
  languageCode: LanguageCode;
  title: string;
  description: string;
  ingredients: Array<{
    name: string;
    notes?: string;
  }>;
  instructions: Array<{
    text: string;
    notes?: string;
  }>;
  metadata: TranslationMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranslationRequest {
  recipeId: ObjectId;
  languageCode: LanguageCode;
  requestedBy: ObjectId;
  status: 'pending' | 'inProgress' | 'completed' | 'failed';
  assignedTo?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  'sv',
  'no',
  'da',
  'fi',
  'en',
  'de',
  'fr',
  'it',
  'es',
  'pt',
  'ja',
  'ko',
  'zh',
];

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  sv: 'Svenska',
  no: 'Norsk',
  da: 'Dansk',
  fi: 'Suomi',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
  pt: 'Português',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};

export interface TranslationInput {
  title: string;
  description: string;
  ingredients: Array<{
    name: string;
    notes?: string;
  }>;
  instructions: Array<{
    text: string;
    notes?: string;
  }>;
  languageCode: LanguageCode;
}

export const DEFAULT_LANGUAGE: LanguageCode = 'sv';

export interface TranslatedField<T> {
  value: T;
  language: LanguageCode;
  translations: Record<LanguageCode, T>;
}

export type TranslatedString = TranslatedField<string>;

export interface TranslationStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  byLanguage: Record<LanguageCode, number>;
  averageConfidence: number;
  automaticCount: number;
  manualCount: number;
}
