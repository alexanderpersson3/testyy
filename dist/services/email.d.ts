interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}
/**
 * Send an email using the configured SMTP transport
 * @param options Email options including recipient, subject, and content
 */
export declare function sendEmail(options: EmailOptions): Promise<void>;
export {};
//# sourceMappingURL=email.d.ts.map