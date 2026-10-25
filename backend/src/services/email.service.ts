import nodemailer from 'nodemailer';
import { config } from '../config/env';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isInitializing = false;

  public async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (this.isInitializing) {
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.transporter) return this.transporter;
    }

    this.isInitializing = true;
    try {
      let user = config.ethereal.user;
      let pass = config.ethereal.pass;

      if (!user || !pass) {
        console.log('[Ethereal] No SMTP credentials provided. Creating real Ethereal test account...');
        const testAccount = await nodemailer.createTestAccount();
        user = testAccount.user;
        pass = testAccount.pass;
        console.log('[Ethereal] Generated Test Account:');
        console.log(`  User: ${user}`);
        console.log(`  Pass: ${pass}`);
        console.log(`  Webmail: https://ethereal.email/login`);
      }

      this.transporter = nodemailer.createTransport({
        host: config.ethereal.host,
        port: config.ethereal.port,
        secure: false,
        auth: {
          user,
          pass,
        },
      });

      console.log('[Ethereal] SMTP Transporter ready');
      return this.transporter;
    } finally {
      this.isInitializing = false;
    }
  }

  public async sendEmail(params: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ messageId: string; previewUrl: string | false }> {
    const transporter = await this.getTransporter();

    const info = await transporter.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || `<div style="font-family: sans-serif; padding: 20px;"><h2>${params.subject}</h2><p>${params.text.replace(/\n/g, '<br/>')}</p></div>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[EmailService] Sent to ${params.to}. MessageId: ${info.messageId}`);
    if (previewUrl) {
      console.log(`[EmailService] 🔗 View Email in Ethereal: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      previewUrl,
    };
  }
}

export const emailService = new EmailService();
