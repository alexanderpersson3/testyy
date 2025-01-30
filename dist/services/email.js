import nodemailer from 'nodemailer';
// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});
/**
 * Send an email using the configured SMTP transport
 * @param options Email options including recipient, subject, and content
 */
export async function sendEmail(options) {
    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@rezepta.com',
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html
        });
    }
    catch (error) {
        console.error('Failed to send email:', error);
        throw new Error('Failed to send email');
    }
}
// Verify SMTP connection on startup
transporter.verify()
    .then(() => console.log('SMTP server is ready to send emails'))
    .catch(error => console.error('SMTP connection error:', error));
//# sourceMappingURL=email.js.map