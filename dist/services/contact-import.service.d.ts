import { ObjectId } from 'mongodb';
import { PhoneContact, ContactImportResult } from '../types/contacts.js';
export declare class ContactImportService {
    private static instance;
    private readonly facebookAuth;
    private readonly instagramAuth;
    private constructor();
    static getInstance(): ContactImportService;
    /**
     * Import phone contacts
     */
    importPhoneContacts(userId: ObjectId, contacts: PhoneContact[]): Promise<ContactImportResult>;
    /**
     * Import Facebook contacts
     */
    importFacebookContacts(userId: ObjectId, accessToken: string): Promise<ContactImportResult>;
    /**
     * Import Instagram contacts
     */
    importInstagramContacts(userId: ObjectId, accessToken: string): Promise<ContactImportResult>;
    /**
     * Normalize phone number to E.164 format
     */
    private normalizePhoneNumber;
}
