import nodemailer from 'nodemailer';
import { Invitation } from '../services/invitation.js';

// Configure email transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendInvitationEmail(invitation: Invitation): Promise<void> {
  const invitationUrl = `${process.env.APP_URL}/invitations/${invitation.token}`;

  const mailOptions = {
    from: `"Rezepta" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: invitation.email,
    subject: `${invitation.name}, you've been invited to join Rezepta!`,
    html: `
      <h1>Welcome to Rezepta!</h1>
      <p>Hi ${invitation.name},</p>
      <p>You've been invited to join Rezepta, your personal recipe and shopping assistant.</p>
      <p>Click the button below to accept your invitation and create your account:</p>
      <p>
        <a href="${invitationUrl}" style="
          display: inline-block;
          padding: 10px 20px;
          background-color: #4CAF50;
          color: white;
          text-decoration: none;
          border-radius: 5px;
        ">
          Accept Invitation
        </a>
      </p>
      <p>This invitation will expire in 7 days.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>Best regards,<br>The Rezepta Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    throw new Error('Failed to send invitation email');
  }
} 