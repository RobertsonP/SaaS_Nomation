import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface EmailAttachment {
  filename: string;
  content: Uint8Array | string;
  contentType?: string;
}

interface SendMailResult {
  messageId: string;
  accepted: string[];
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);
  private readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

    if (!this.isConfigured) {
      this.logger.warn('SMTP not configured - emails will be logged but NOT sent. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    this.logger.log('Email service configured successfully');
  }

  async sendEmail(to: string, subject: string, html: string, attachments?: EmailAttachment[]): Promise<SendMailResult> {
    // If SMTP is not configured, log the email instead of sending
    if (!this.isConfigured || !this.transporter) {
      this.logger.log(`[DEV MODE] Email would be sent to: ${to}`);
      this.logger.log(`[DEV MODE] Subject: ${subject}`);
      this.logger.debug(`[DEV MODE] HTML content length: ${html.length} characters`);
      return { messageId: 'dev-mode-not-sent', accepted: [to] };
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Nomation" <noreply@nomation.dev>',
        to,
        subject,
        html,
        attachments: attachments as nodemailer.SendMailOptions['attachments'],
      });
      this.logger.log(`Email sent: ${info.messageId}`);
      return { messageId: info.messageId || '', accepted: info.accepted as string[] || [to] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email: ${message}`);
      throw error;
    }
  }
}
