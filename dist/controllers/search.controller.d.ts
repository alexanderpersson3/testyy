import type { Request, Response } from '../types/index.js';
export declare const searchController: {
    /**
     * Search products
     */
    search(req: Request, res: Response): Promise<void>;
    /**
     * Get search suggestions
     */
    getSuggestions(req: Request, res: Response): Promise<void>;
    /**
     * Index a product
     */
    indexProduct(req: Request, res: Response): Promise<void>;
    /**
     * Update indexed product
     */
    updateProduct(req: Request, res: Response): Promise<void>;
    /**
     * Delete indexed product
     */
    deleteProduct(req: Request, res: Response): Promise<void>;
    /**
     * Initialize product index
     */
    initializeIndex(req: Request, res: Response): Promise<void>;
};
