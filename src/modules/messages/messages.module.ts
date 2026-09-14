import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  providers: [MessagesService, MessagesGateway],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
