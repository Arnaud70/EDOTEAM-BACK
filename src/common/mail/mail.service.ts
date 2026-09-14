import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly endpoint = 'https://api.brevo.com/v3/smtp/email';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('BREVO_API_KEY') &&
      this.config.get<string>('MAIL_FROM_NAME') &&
      this.config.get<string>('MAIL_FROM_EMAIL'),
    );
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const senderName = this.config.get<string>('MAIL_FROM_NAME');
    const senderEmail = this.config.get<string>('MAIL_FROM_EMAIL');

    if (!apiKey || !senderName || !senderEmail) {
      throw new ServiceUnavailableException(
        'Configuration email Brevo incomplète.',
      );
    }

    if (!this.isValidEmail(options.to) || !this.isValidEmail(senderEmail)) {
      throw new BadRequestException('Adresse email invalide.');
    }

    if (!options.html && !options.text) {
      throw new BadRequestException('Le contenu de l’email est obligatoire.');
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: options.to }],
        subject: options.subject,
        ...(options.html ? { htmlContent: options.html } : {}),
        ...(options.text ? { textContent: options.text } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `Brevo a refusé l’envoi (${response.status}).`;
      try {
        const parsed = JSON.parse(errorBody) as { message?: string };
        if (parsed.message) message = `${message} ${parsed.message}`;
      } catch {
        // La réponse Brevo peut ne pas être du JSON.
      }
      throw new Error(message);
    }

    this.logger.log(`Email envoyé via Brevo à ${this.maskEmail(options.to)}.`);
  }

  async sendTestEmail(to: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'EDOTEAM - Test Brevo',
      text: 'Cet email confirme que l’API HTTPS Brevo est correctement configurée.',
      html: '<p>Cet email confirme que l’API HTTPS Brevo est correctement configurée.</p>',
    });
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    return `${localPart.slice(0, 2)}***@${domain}`;
  }
}
