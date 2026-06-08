import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly mailFrom: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('smtpHost') || '';
    const port = this.configService.get<number>('smtpPort') || 587;
    const user = this.configService.get<string>('smtpUser') || '';
    const pass = this.configService.get<string>('smtpPassword') || '';
    this.mailFrom = this.configService.get<string>('mailFrom') || 'Apex CRM <noreply@apex.com>';

    this.logger.log(`Initializing SMTP Transporter: ${host}:${port} (User: ${user})`);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    automationExecutionId?: string;
  }): Promise<void> {
    const { to, subject, html, automationExecutionId } = params;
    const logPrefix = automationExecutionId ? `[Execution Trace: ${automationExecutionId}] ` : '';

    this.logger.log(`${logPrefix}Sending email to ${to}`);

    try {
      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject,
        html,
      });
      this.logger.log(`${logPrefix}Email delivered successfully`);
    } catch (error: any) {
      this.logger.error(`${logPrefix}Email delivery failed`);
      throw error;
    }
  }
}
