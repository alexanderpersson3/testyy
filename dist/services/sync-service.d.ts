import { SyncItem } from '../types/sync.js';
export declare class SyncService {
    private collection;
    constructor();
    private initializeCollection;
    createBatch(items: SyncItem[], clientId: string): Promise<string>;
    processBatch(batchId: string): Promise<void>;
    private getCollectionName;
}
export declare const syncService: SyncService;
