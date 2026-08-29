import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthTokensService } from './auth-tokens.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    ActivityLogsModule,
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthTokensService, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
