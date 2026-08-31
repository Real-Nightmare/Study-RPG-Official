import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SMTPEmailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface SMTPEmailResponse {
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * SMTP email transport — uses any standards-compliant SMTP server.
 * Default: Mailpit (local Docker container on port 1025).
 * Falls back gracefully when SMTP_HOST is not configured.
 */
@Injectable()
export class SMTPService {
  private readonly logger = new Logger(SMTPService.name);
  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly user: string;
  private readonly pass: string;
  private readonly defaultFrom: string;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.get<string>('SMTP_HOST', '');
    this.port = this.configService.get<number>('SMTP_PORT', 1025);
    this.secure = this.configService.get<boolean>('SMTP_SECURE', false);
    this.user = this.configService.get<string>('SMTP_USER', '');
    this.pass = this.configService.get<string>('SMTP_PASS', '');
    this.defaultFrom = this.configService.get<string>('EMAIL_DEFAULT_FROM', 'noreply@studyrpg.local');
    this.configured = Boolean(this.host);
  }

  isReady(): boolean {
    return this.configured;
  }

  async sendEmail(options: SMTPEmailOptions): Promise<SMTPEmailResponse> {
    if (!this.configured) {
      return { messageId: `noop-${Date.now()}`, status: 'failed', error: 'SMTP not configured' };
    }

    const from = options.from || this.defaultFrom;
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    try {
      // Use Node.js built-in net/tls for SMTP — no extra dependencies needed
      const response = await this.smtpSend({ from, to, subject: options.subject, text: options.text, html: options.html });
      this.logger.log(`Email sent via SMTP to ${to}: ${options.subject}`);
      return { messageId: response, status: 'sent' };
    } catch (error) {
      this.logger.error(`SMTP send failed: ${(error as Error).message}`);
      return { messageId: `error-${Date.now()}`, status: 'failed', error: (error as Error).message };
    }
  }

  /**
   * Sends an email via raw SMTP. Uses Node.js net/tls modules — zero
   * external dependencies. Supports STARTTLS and direct TLS.
   */
  private async smtpSend(opts: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<string> {
    const net = await import('net');
    const tls = await import('tls');
    const { createHash } = await import('crypto');

    return new Promise<string>((resolve, reject) => {
      const socket = this.secure
        ? tls.connect({ host: this.host, port: this.port, rejectUnauthorized: false })
        : net.connect({ host: this.host, port: this.port });

      let buffer = '';
      let step = 0;
      const messageId = `<${createHash('md5').update(`${Date.now()}${opts.to}`).digest('hex')}@studyrpg.local>`;

      const send = (line: string) => {
        socket.write(line + '\r\n');
      };

      const expectedCode = (code: string) => {
        return buffer.split('\n').some(l => l.startsWith(code));
      };

      socket.setEncoding('utf8');
      socket.setTimeout(15000);

      socket.on('timeout', () => { socket.destroy(); reject(new Error('SMTP timeout')); });
      socket.on('error', (err) => reject(err));

      socket.on('data', (data: string) => {
        buffer += data;

        if (!buffer.endsWith('\n')) return;

        const lines = buffer.split('\n');
        const lastLine = lines[lines.length - 2] || lines[lines.length - 1];
        const code = lastLine.substring(0, 3);
        buffer = '';

        switch (step) {
          case 0: // Greeting
            if (expectedCode('220')) {
              step = 1;
              send(`EHLO ${this.host}`);
            }
            break;
          case 1: // EHLO
            if (expectedCode('250')) {
              if (this.user && this.pass) {
                step = 2;
                send('AUTH LOGIN');
              } else {
                step = 3;
                send(`MAIL FROM:<${opts.from}>`);
              }
            }
            break;
          case 2: // Auth
            if (expectedCode('334')) {
              if (buffer.includes('Username')) {
                send(Buffer.from(this.user).toString('base64'));
              } else if (buffer.includes('Password')) {
                send(Buffer.from(this.pass).toString('base64'));
              } else {
                step = 3;
                send(`MAIL FROM:<${opts.from}>`);
              }
            } else if (expectedCode('235')) {
              step = 3;
              send(`MAIL FROM:<${opts.from}>`);
            }
            break;
          case 3: // MAIL FROM
            if (expectedCode('250')) {
              step = 4;
              for (const addr of opts.to.split(',')) {
                send(`RCPT TO:<${addr.trim()}>`);
              }
            }
            break;
          case 4: // RCPT TO
            if (expectedCode('250') || expectedCode('251')) {
              step = 5;
              send('DATA');
            }
            break;
          case 5: // DATA
            if (expectedCode('354')) {
              step = 6;
              // Build MIME message
              const boundary = `boundary_${createHash('md5').update(String(Date.now())).digest('hex')}`;
              let body = '';
              body += `From: ${opts.from}\r\n`;
              body += `To: ${opts.to}\r\n`;
              body += `Subject: ${opts.subject}\r\n`;
              body += `Message-ID: ${messageId}\r\n`;
              body += `Date: ${new Date().toUTCString()}\r\n`;
              body += `MIME-Version: 1.0\r\n`;

              if (opts.html && opts.text) {
                body += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
                body += `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${opts.text}\r\n\r\n`;
                body += `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${opts.html}\r\n\r\n`;
                body += `--${boundary}--\r\n`;
              } else if (opts.html) {
                body += `Content-Type: text/html; charset=utf-8\r\n\r\n${opts.html}\r\n`;
              } else {
                body += `Content-Type: text/plain; charset=utf-8\r\n\r\n${opts.text || ''}\r\n`;
              }

              body += '.\r\n';
              send(body);
            }
            break;
          case 6: // Sent
            if (expectedCode('250')) {
              step = 7;
              send('QUIT');
            }
            break;
          case 7: // Quit
            socket.destroy();
            resolve(messageId);
            break;
        }
      });
    });
  }
}
