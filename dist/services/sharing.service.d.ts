import { ShareWithDetails, ShareQuery, CreateShareDTO, UpdateShareDTO, ShareAccess, ShareResult, ShareStats, ShareMetrics } from '../types/sharing.js';
export declare class SharingService {
    private static instance;
    private constructor();
    static getInstance(): SharingService;
    /**
     * Create a new share
     */
    createShare(recipeId: string, userId: string, data: CreateShareDTO): Promise<ShareResult>;
    /**
     * Update a share
     */
    updateShare(shareId: string, userId: string, data: UpdateShareDTO): Promise<void>;
    /**
     * Delete a share
     */
    deleteShare(shareId: string, userId: string): Promise<void>;
    /**
     * Get shares with optional filtering
     */
    getShares(query: ShareQuery): Promise<ShareWithDetails[]>;
    /**
     * Access a shared recipe
     */
    accessShare(access: ShareAccess): Promise<ShareResult>;
    /**
     * Get share statistics
     */
    getShareStats(userId: string): Promise<ShareStats>;
    /**
     * Get share metrics
     */
    getShareMetrics(shareId: string): Promise<ShareMetrics>;
    /**
     * Get a share with full details
     */
    private getShareWithDetails;
    /**
     * Generate share URL
     */
    private generateShareUrl;
    /**
     * Track share metrics
     */
    private trackShareMetrics;
}
