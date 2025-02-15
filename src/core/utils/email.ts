import type { Recipe } from '../types/express.js';
import nodemailer from 'nodemailer';
import { config } from '../config.js';;

interface EmailConfig {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

const defaultFrom = '"Rezepta" <noreply@rezepta.com>';

const emailConfig: EmailConfig = {
  host: process.env.SMTP_HOST || config.email.host,
  port: process.env.SMTP_PORT || config.email.port,
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || config.email.user,
  password: process.env.SMTP_PASSWORD || config.email.password,
  from: process.env.SMTP_FROM || defaultFrom
};

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: emailConfig.host,
  port: parseInt(emailConfig.port, 10),
  secure: emailConfig.secure,
  auth: {
    user: emailConfig.user,
    pass: emailConfig.password,
  },
});

/**
 * Send a recipe share email
 */
export async function sendShareEmail(
  to: string,
  shareUrl: string,
  recipeName: string,
  fromUserId: string
): Promise<void> {
  const user = await getUserDetails(fromUserId);
  const fromName = user?.username || 'A Rezepta user';

  const mailOptions = {
    from: emailConfig.from,
    to,
    subject: `${fromName} shared a recipe with you: ${recipeName}`,
    text: generatePlainTextEmail(fromName, recipeName, shareUrl),
    html: generateHtmlEmail(fromName, recipeName, shareUrl),
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Send an invitation email
 */
export const sendInvitationEmail = async (
  email: string,
  invitationCode: string,
  invitedBy?: string
): Promise<void> => {
  const invitationLink = `${process.env.APP_URL}/join?code=${invitationCode}`;
  const invitedByText = invitedBy
    ? `You have been invited by ${invitedBy} to join Rezepta.`
    : 'You have been invited to join Rezepta.';

  const mailOptions = {
    from: emailConfig.from,
    to: email,
    subject: 'Join Rezepta - Your Personal Recipe Assistant',
    html: `
      <h2>Welcome to Rezepta!</h2>
      <p>${invitedByText}</p>
      <p>Click the link below to join:</p>
      <p><a href="${invitationLink}">${invitationLink}</a></p>
      <p>This invitation link will expire in 24 hours.</p>
      <p>If you did not request this invitation, please ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw new Error('Failed to send invitation email');
  }
};

/**
 * Get user details for email
 */
async function getUserDetails(userId: string): Promise<{ username: string } | null> {
  // This would typically fetch user details from the database
  // For now, we'll return null and let the default name be used
  return null;
}

/**
 * Generate plain text email content
 */
function generatePlainTextEmail(fromName: string, recipeName: string, shareUrl: string): string {
  return `
${fromName} has shared a recipe with you on Rezepta!

Recipe: ${recipeName}

View the recipe here:
${shareUrl}

Enjoy cooking!

- The Rezepta Team
`;
}

/**
 * Generate HTML email content
 */
function generateHtmlEmail(fromName: string, recipeName: string, shareUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      background-color: #4CAF50;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>${fromName} has shared a recipe with you on Rezepta!</h2>
    
    <p>Recipe: <strong>${recipeName}</strong></p>
    
    <p>Click the button below to view the recipe:</p>
    
    <a href="${shareUrl}" class="button">View Recipe</a>
    
    <p>Or copy this link:</p>
    <p>${shareUrl}</p>
    
    <div class="footer">
      <p>Enjoy cooking!</p>
      <p>- The Rezepta Team</p>
    </div>
  </div>
</body>
</html>
`;
}
