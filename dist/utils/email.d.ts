/**
 * Send a recipe share email
 */
export declare function sendShareEmail(to: string, shareUrl: string, recipeName: string, fromUserId: string): Promise<void>;
/**
 * Send an invitation email
 */
export declare const sendInvitationEmail: (email: string, invitationCode: string, invitedBy?: string) => Promise<void>;
