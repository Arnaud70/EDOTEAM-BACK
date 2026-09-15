import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { buildCacheOptions } from './common/cache/cache.config';
import { MailModule } from './common/mail/mail.module';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';

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
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: buildCacheOptions,
    }),
    MailModule,
    CloudinaryModule,
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
    PaymentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
