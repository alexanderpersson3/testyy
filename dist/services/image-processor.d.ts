interface ProcessedImage {
    buffer: Buffer;
    format: string;
    width: number;
    height: number;
}
/**
 * Preprocesses an image to improve OCR accuracy
 */
export declare function preprocessImage(buffer: Buffer): Promise<ProcessedImage>;
/**
 * Detects and corrects skewed text in an image
 */
export declare function deskewImage(buffer: Buffer): Promise<Buffer>;
/**
 * Detects text regions in an image and crops to the main content
 */
export declare function cropToContent(buffer: Buffer): Promise<Buffer>;
export {};
