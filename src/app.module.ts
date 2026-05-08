import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MailerModule } from '@nestjs-modules/mailer';
import { CacheModule } from '@nestjs/cache-manager';

// Core
import { PrismaModule } from './prisma/prisma.module';

// Modules (src/modules/)
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ServicesModule } from './modules/services/services.module';

// New modules (src/modules/)
import { MessagesModule } from './modules/messages/messages.module';
import { AvisModule } from './modules/avis/avis.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AdminModule } from './modules/admin/admin.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { UploadModule } from './modules/upload/upload.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    CacheModule.register({
      isGlobal: true,
      ttl: 300000, // 5 minutes
      max: 100,
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST') || 'smtp.ethereal.email',
          port: config.get('SMTP_PORT') || 587,
          auth: {
            user: config.get('SMTP_USER') || 'test@ethereal.email',
            pass: config.get('SMTP_PASS') || 'password',
          },
        },
        defaults: {
          from: `"${config.get('MAIL_FROM_NAME') || 'EDOTEAM'}" <${config.get('MAIL_FROM_EMAIL') || 'noreply@edoteam.tg'}>`,
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    MessagesModule,
    AvisModule,
    ReportsModule,
    AvailabilityModule,
    AdminModule,
    ActivityLogsModule,
    BookingsModule,
    WalletModule,
    UploadModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
