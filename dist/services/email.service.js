import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
export class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    async sendEmail(options) {
        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });
        }
        catch (error) {
            logger.error('Failed to send email:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=email.service.js.map