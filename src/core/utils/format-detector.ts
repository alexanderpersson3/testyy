import { ImportFormat } from '../types/export.js';;
import logger from '../utils/logger.js';

export interface FormatDetectionResult {
  format?: ImportFormat;
  confidence: number;
  possibleFormats: Array<{
    format: ImportFormat;
    confidence: number;
  }>;
  metadata?: {
    version?: string;
    generator?: string;
    timestamp?: Date;
  };
}

interface FormatSignature {
  format: ImportFormat;
  patterns: RegExp[];
  metadataExtractors: Array<(content: string) => Record<string, any>>;
}

const formatSignatures: FormatSignature[] = [
  {
    format: 'json',
    patterns: [/^\s*{\s*"[^"]+"\s*:/, /^\s*\[\s*{\s*"[^"]+"\s*:/],
    metadataExtractors: [
      (content: string) => {
        try {
          const data = JSON.parse(content);
          return {
            version: data.version,
            generator: data.generator,
            timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
          };
        } catch {
          return {};
        }
      },
    ],
  },
  {
    format: 'csv',
    patterns: [/^[^,\n]*,[^,\n]*,[^,\n]*\n/, /^"[^"]*","[^"]*","[^"]*"\n/],
    metadataExtractors: [
      () => ({}), // CSV doesn't typically have metadata
    ],
  },
];

export function detectFormat(content: string): FormatDetectionResult {
  try {
    const results = formatSignatures.map(signature => {
      const confidence = calculateConfidence(content, signature);
      return {
        format: signature.format,
        confidence,
      };
    });

    // Sort by confidence
    results.sort((a: any, b: any) => b.confidence - a.confidence);

    // Get metadata from the most likely format
    const bestMatch = results[0];
    const metadata =
      bestMatch.confidence > 0.7
        ? extractMetadata(content, formatSignatures.find(s => s.format === bestMatch.format)!)
        : undefined;

    return {
      format: bestMatch.confidence > 0.7 ? bestMatch.format : undefined,
      confidence: bestMatch.confidence,
      possibleFormats: results,
      metadata,
    };
  } catch (error) {
    logger.error('Error detecting format:', error);
    return {
      confidence: 0,
      possibleFormats: [],
    };
  }
}

function calculateConfidence(content: string, signature: FormatSignature): number {
  let confidence = 0;

  // Check patterns
  for (const pattern of signature.patterns) {
    if (pattern.test(content)) {
      confidence += 0.4;
    }
  }

  // Additional format-specific checks
  switch (signature.format) {
    case 'json':
      try {
        JSON.parse(content);
        confidence += 0.6;
      } catch {
        confidence = 0;
      }
      break;
    case 'csv':
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const headerCount = lines[0].split(',').length;
        const allSameColumns = lines.every(line => line.split(',').length === headerCount);
        if (allSameColumns) {
          confidence += 0.6;
        }
      }
      break;
  }

  return Math.min(1, confidence);
}

function extractMetadata(
  content: string,
  signature: FormatSignature
): Record<string, any> | undefined {
  for (const extractor of signature.metadataExtractors) {
    try {
      const metadata = extractor(content);
      if (Object.keys(metadata).length > 0) {
        return metadata;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}
