import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          // ← was reading SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS, but the
          // .env file (and everywhere else in this app) uses the MAIL_
          // prefix — MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS. The old
          // keys never matched anything in .env, so config.get() always
          // returned undefined for host/user/pass, meaning the mailer
          // never had real SMTP credentials to connect with. Every email
          // send call was catching a connection/auth error silently
          // (each method in mail.service.ts wraps sendMail in try/catch
          // and just logs it) — no visible error, no emails ever sent.
          host: config.get<string>('MAIL_HOST'),
          port: config.get<number>('MAIL_PORT', 587),
          // true for port 465, false for 587/others (STARTTLS)
          secure: config.get<string>('MAIL_SECURE', 'false') === 'true',
          auth: {
            user: config.get<string>('MAIL_USER'),
            pass: config.get<string>('MAIL_PASS'),
          },
          // ── Force IPv4 ──
          // Railway containers don't have outbound IPv6 routing, but
          // Node's DNS resolution can still hand back smtp.gmail.com's
          // AAAA (IPv6) record first, so the socket tries to connect over
          // IPv6 and dies with ENETUNREACH — this is exactly the error
          // you were hitting. Forcing family: 4 makes it resolve/connect
          // over IPv4 only, which Railway can actually route.
          family: 4,
        },
        defaults: {
          from: config.get<string>('MAIL_FROM') || `"SSIPL TMS" <${config.get<string>('MAIL_USER')}>`,
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}