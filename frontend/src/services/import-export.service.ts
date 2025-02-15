import { Recipe } from './recipe.service';

export interface ImportResult {
  success: boolean;
  recipeId?: string;
  errors?: string[];
}

export type ImportFormat = 'json' | 'text' | 'image' | 'url';

export interface ImportOptions {
  format: ImportFormat;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  defaultTags?: string[];
  defaultPrivacy?: 'public' | 'private' | 'followers';
  language?: string;
}

export interface ExportOptions {
  format: 'json' | 'pdf' | 'text';
  includeImages?: boolean;
  includeTags?: boolean;
  includeNutrition?: boolean;
  language?: string;
}

export interface ImportSource {
  type: 'url' | 'text' | 'file' | 'image';
  content: string;
  metadata?: {
    title?: string;
    source?: string;
    language?: string;
  };
}

export interface ExportFormat {
  type: 'json' | 'markdown' | 'pdf' | 'text';
  options?: {
    includeImages?: boolean;
    includeNutrition?: boolean;
    includeTags?: boolean;
    template?: string;
    language?: string;
  };
}

interface ExtendedRequestInit extends RequestInit {
  responseType?: 'blob' | 'json' | 'text';
}

class ImportExportService {
  private static instance: ImportExportService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  }

  public static getInstance(): ImportExportService {
    if (!ImportExportService.instance) {
      ImportExportService.instance = new ImportExportService();
    }
    return ImportExportService.instance;
  }

  private async request<T>(
    endpoint: string,
    options: ExtendedRequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  }

  async importRecipe(
    file: File,
    options: ImportOptions
  ): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));

    return this.request<ImportResult>('/recipes/import', {
      method: 'POST',
      body: formData,
    });
  }

  async importFromUrl(
    url: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    return this.request<ImportResult>('/recipes/import/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, options }),
    });
  }

  async exportRecipe(
    recipeId: string,
    options: ExportOptions
  ): Promise<Blob> {
    const queryParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });

    const response = await fetch(
      `${this.baseUrl}/recipes/${recipeId}/export?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'An error occurred');
    }

    return response.blob();
  }

  async exportMultipleRecipes(
    recipeIds: string[],
    options: ExportOptions
  ): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/recipes/export-multiple`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ recipeIds, options }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'An error occurred');
    }

    return response.blob();
  }

  async parseRecipeFromText(text: string): Promise<Partial<Recipe>> {
    return this.request<Partial<Recipe>>('/recipes/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  }

  async importFromImage(
    imageData: string | File,
    options?: ImportOptions
  ): Promise<ImportResult> {
    const formData = new FormData();
    if (typeof imageData === 'string') {
      formData.append('image', imageData);
    } else {
      formData.append('file', imageData);
    }
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    return this.request<ImportResult>('/import/image', {
      method: 'POST',
      body: formData,
    });
  }

  async importFromPdf(
    pdfData: string | File,
    options?: ImportOptions
  ): Promise<ImportResult> {
    const formData = new FormData();
    if (typeof pdfData === 'string') {
      formData.append('pdf', pdfData);
    } else {
      formData.append('file', pdfData);
    }
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    return this.request<ImportResult>('/import/pdf', {
      method: 'POST',
      body: formData,
    });
  }

  async importFromClipboard(
    text: string,
    options?: ImportOptions
  ): Promise<ImportResult> {
    return this.request<ImportResult>('/import/clipboard', {
      method: 'POST',
      body: JSON.stringify({
        text,
        options,
      }),
    });
  }

  async exportToPdf(
    recipeId: string,
    options?: ExportFormat['options']
  ): Promise<Blob> {
    const response = await this.request('/export/pdf/' + recipeId, {
      method: 'POST',
      body: JSON.stringify(options),
      responseType: 'blob',
    });
    return response as Blob;
  }

  async exportToMarkdown(
    recipeId: string,
    options?: ExportFormat['options']
  ): Promise<string> {
    return this.request<string>('/export/markdown/' + recipeId, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async exportMultipleToZip(
    recipeIds: string[],
    format: ExportFormat['type'],
    options?: ExportFormat['options']
  ): Promise<Blob> {
    const response = await this.request('/export/zip', {
      method: 'POST',
      body: JSON.stringify({
        recipeIds,
        format,
        options,
      }),
      responseType: 'blob',
    });
    return response as Blob;
  }

  async validateImportSource(source: ImportSource): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    return this.request<{ isValid: boolean; errors: string[] }>('/import/validate', {
      method: 'POST',
      body: JSON.stringify(source),
    });
  }

  async getImportHistory(limit: number = 10, offset: number = 0): Promise<{
    imports: Array<{
      id: string;
      source: ImportSource;
      result: ImportResult;
      timestamp: Date;
    }>;
    total: number;
  }> {
    return this.request<{
      imports: Array<{
        id: string;
        source: ImportSource;
        result: ImportResult;
        timestamp: Date;
      }>;
      total: number;
    }>(`/import/history?limit=${limit}&offset=${offset}`);
  }

  async getExportHistory(limit: number = 10, offset: number = 0): Promise<{
    exports: Array<{
      id: string;
      recipeId: string;
      format: ExportFormat;
      timestamp: Date;
    }>;
    total: number;
  }> {
    return this.request<{
      exports: Array<{
        id: string;
        recipeId: string;
        format: ExportFormat;
        timestamp: Date;
      }>;
      total: number;
    }>(`/export/history?limit=${limit}&offset=${offset}`);
  }
}

export const importExportService = ImportExportService.getInstance(); 