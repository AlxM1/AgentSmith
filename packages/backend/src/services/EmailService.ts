/**
 * Email Service
 *
 * SMTP-based email sending service with template support
 */

import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

const EMAIL_TEMPLATES: Record<string, { subject: string; html: string; text: string }> = {
  welcome: {
    subject: 'Welcome to AgentSmith!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: 0; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to AgentSmith!</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <p>Welcome to AgentSmith! Your account has been created successfully.</p>
            <p>AgentSmith is a powerful workflow automation platform that helps you connect apps and automate tasks.</p>
            <a href="{{loginUrl}}" class="button">Get Started</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; {{year}} AgentSmith. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to AgentSmith!

Hi {{firstName}},

Welcome to AgentSmith! Your account has been created successfully.

AgentSmith is a powerful workflow automation platform that helps you connect apps and automate tasks.

Get started: {{loginUrl}}

If you have any questions, feel free to reach out to our support team.

© {{year}} AgentSmith. All rights reserved.`,
  },

  passwordReset: {
    subject: 'Reset Your Password - AgentSmith',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: 0; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="{{resetUrl}}" class="button">Reset Password</a>
            <div class="warning">
              <strong>Note:</strong> This link will expire in {{expiresIn}}.
            </div>
            <p>If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>
          </div>
          <div class="footer">
            <p>&copy; {{year}} AgentSmith. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Password Reset Request

Hi {{firstName}},

We received a request to reset your password.

Reset your password: {{resetUrl}}

This link will expire in {{expiresIn}}.

If you didn't request this, you can safely ignore this email.

© {{year}} AgentSmith. All rights reserved.`,
  },

  workflowFailed: {
    subject: 'Workflow Failed - {{workflowName}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: 0; }
          .error-box { background: #fee2e2; border: 1px solid #ef4444; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .code { background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 6px; font-family: monospace; overflow-x: auto; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Workflow Execution Failed</h1>
          </div>
          <div class="content">
            <p>The following workflow has failed:</p>
            <ul>
              <li><strong>Workflow:</strong> {{workflowName}}</li>
              <li><strong>Execution ID:</strong> {{executionId}}</li>
              <li><strong>Failed At:</strong> {{failedAt}}</li>
              <li><strong>Failed Node:</strong> {{failedNode}}</li>
            </ul>
            <div class="error-box">
              <strong>Error:</strong>
              <div class="code">{{errorMessage}}</div>
            </div>
            <a href="{{executionUrl}}" class="button">View Execution Details</a>
          </div>
          <div class="footer">
            <p>&copy; {{year}} AgentSmith. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Workflow Execution Failed

The following workflow has failed:

- Workflow: {{workflowName}}
- Execution ID: {{executionId}}
- Failed At: {{failedAt}}
- Failed Node: {{failedNode}}

Error: {{errorMessage}}

View details: {{executionUrl}}

© {{year}} AgentSmith. All rights reserved.`,
  },

  twoFactorEnabled: {
    subject: 'Two-Factor Authentication Enabled - AgentSmith',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: 0; }
          .success { background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>2FA Enabled Successfully</h1>
          </div>
          <div class="content">
            <p>Hi {{firstName}},</p>
            <div class="success">
              Two-factor authentication has been enabled on your account.
            </div>
            <p>Your account is now more secure. You'll need to enter a verification code from your authenticator app each time you sign in.</p>
            <p><strong>Important:</strong> Make sure you've saved your backup codes in a safe place. You'll need them if you lose access to your authenticator app.</p>
            <p>If you didn't make this change, please contact support immediately.</p>
          </div>
          <div class="footer">
            <p>&copy; {{year}} AgentSmith. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Two-Factor Authentication Enabled

Hi {{firstName}},

Two-factor authentication has been enabled on your account.

Your account is now more secure. You'll need to enter a verification code from your authenticator app each time you sign in.

Important: Make sure you've saved your backup codes in a safe place.

If you didn't make this change, please contact support immediately.

© {{year}} AgentSmith. All rights reserved.`,
  },

  inviteUser: {
    subject: "You've been invited to AgentSmith",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: 0; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited!</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p><strong>{{inviterName}}</strong> has invited you to join AgentSmith - a powerful workflow automation platform.</p>
            <p>Click the button below to accept the invitation and create your account:</p>
            <a href="{{inviteUrl}}" class="button">Accept Invitation</a>
            <p>This invitation will expire in {{expiresIn}}.</p>
          </div>
          <div class="footer">
            <p>&copy; {{year}} AgentSmith. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `You're Invited to AgentSmith!

{{inviterName}} has invited you to join AgentSmith - a powerful workflow automation platform.

Accept your invitation: {{inviteUrl}}

This invitation will expire in {{expiresIn}}.

© {{year}} AgentSmith. All rights reserved.`,
  },
};

// ============================================================================
// EMAIL SERVICE CLASS
// ============================================================================

class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;
  private isInitialized = false;

  /**
   * Initialize the email service
   */
  async initialize(emailConfig?: EmailConfig): Promise<void> {
    const smtpConfig = emailConfig || config.email;

    if (!smtpConfig?.host) {
      logger.warn('Email service not configured - emails will be logged only');
      return;
    }

    this.config = {
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure ?? (smtpConfig.port === 465),
      user: smtpConfig.user,
      password: smtpConfig.password,
      fromEmail: smtpConfig.fromEmail || 'noreply@agentsmith.io',
      fromName: smtpConfig.fromName || 'AgentSmith',
    };

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.user ? {
          user: this.config.user,
          pass: this.config.password,
        } : undefined,
      });

      // Verify connection
      await this.transporter.verify();

      this.isInitialized = true;
      logger.info('Email service initialized', {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
      });
    } catch (error) {
      logger.error('Failed to initialize email service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    // If using a template, render it
    let subject = options.subject;
    let html = options.html;
    let text = options.text;

    if (options.templateId && EMAIL_TEMPLATES[options.templateId]) {
      const template = EMAIL_TEMPLATES[options.templateId];
      const data = {
        ...options.templateData,
        year: new Date().getFullYear(),
      };

      subject = this.renderTemplate(template.subject, data);
      html = this.renderTemplate(template.html, data);
      text = this.renderTemplate(template.text, data);
    }

    // If not initialized, log the email instead of sending
    if (!this.isInitialized || !this.transporter) {
      logger.info('Email would be sent (service not configured)', {
        to: options.to,
        subject,
      });
      return { success: true, messageId: 'dev-' + Date.now() };
    }

    const mailOptions: SendMailOptions = {
      from: `"${this.config!.fromName}" <${this.config!.fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject,
      text,
      html,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      attachments: options.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to: options.to,
        subject,
        messageId: result.messageId,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send email', {
        to: options.to,
        subject,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send using a template
   */
  async sendTemplate(
    templateId: string,
    to: string | string[],
    data: Record<string, unknown>
  ): Promise<EmailResult> {
    if (!EMAIL_TEMPLATES[templateId]) {
      return { success: false, error: `Template not found: ${templateId}` };
    }

    return this.send({
      to,
      subject: '', // Will be set by template
      templateId,
      templateData: data,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcome(email: string, firstName: string, loginUrl: string): Promise<EmailResult> {
    return this.sendTemplate('welcome', email, { firstName, loginUrl });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(
    email: string,
    firstName: string,
    resetUrl: string,
    expiresIn: string = '1 hour'
  ): Promise<EmailResult> {
    return this.sendTemplate('passwordReset', email, { firstName, resetUrl, expiresIn });
  }

  /**
   * Send workflow failure notification
   */
  async sendWorkflowFailed(params: {
    email: string;
    workflowName: string;
    executionId: string;
    failedAt: string;
    failedNode: string;
    errorMessage: string;
    executionUrl: string;
  }): Promise<EmailResult> {
    return this.sendTemplate('workflowFailed', params.email, params);
  }

  /**
   * Send 2FA enabled notification
   */
  async send2FAEnabled(email: string, firstName: string): Promise<EmailResult> {
    return this.sendTemplate('twoFactorEnabled', email, { firstName });
  }

  /**
   * Send user invitation
   */
  async sendInvitation(params: {
    email: string;
    inviterName: string;
    inviteUrl: string;
    expiresIn: string;
  }): Promise<EmailResult> {
    return this.sendTemplate('inviteUser', params.email, params);
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Send a test email
   */
  async sendTestEmail(to: string): Promise<EmailResult> {
    return this.send({
      to,
      subject: 'AgentSmith Test Email',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from AgentSmith.</p>
        <p>If you received this, your email configuration is working correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      text: `Test Email\n\nThis is a test email from AgentSmith.\nSent at: ${new Date().toISOString()}`,
    });
  }

  /**
   * Render a template with data
   */
  private renderTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Get available template IDs
   */
  getAvailableTemplates(): string[] {
    return Object.keys(EMAIL_TEMPLATES);
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Also export the class for testing
export { EmailService };
