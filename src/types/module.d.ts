declare module 'pdf.js-extract' {
  export interface PDFExtractText {
    str: string;
    x: number;
    y: number;
    w: number;
    h: number;
    fontName: string;
  }

  export interface PDFExtractPage {
    pageInfo: {
      num: number;
      scale: number;
      rotation: number;
      offsetX: number;
      offsetY: number;
      width: number;
      height: number;
    };
    content: PDFExtractText[];
  }

  export interface PDFExtractResult {
    pages: PDFExtractPage[];
    filename: string;
  }

  export class PDFExtract {
    extract(filename: string, options?: any): Promise<PDFExtractResult>;
  }
}

declare module 'tesseract.js' {
  interface TesseractWorker {
    loadLanguage(lang: string): Promise<void>;
    initialize(lang: string): Promise<void>;
    recognize(image: Buffer): Promise<{
      data: {
        text: string;
      };
    }>;
    terminate(): Promise<void>;
  }

  export function createWorker(): Promise<TesseractWorker>;
}

declare module 'multer' {
  import { Request } from 'express';

  interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination?: string;
    filename?: string;
    path?: string;
    buffer?: Buffer;
  }

  interface Options {
    dest?: string;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    fileFilter?(req: Request, file: File, callback: (error: Error | null, acceptFile: boolean) => void): void;
  }

  interface Instance {
    single(fieldname: string): any;
    array(fieldname: string, maxCount?: number): any;
    fields(fields: Array<{ name: string; maxCount?: number }>): any;
    none(): any;
  }

  function multer(options?: Options): Instance;
  export = multer;
}

// Extend Express Request type to include file from multer
declare global {
  namespace Express {
    interface Request {
      file?: import('multer').File;
    }
  }
} 
