import { Module } from '@nestjs/common';
import { AvisService } from './avis.service';
import { AvisController } from './avis.controller';
import { MessagesModule } from '../messages/messages.module';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MessagesModule, NotificationsModule],
  providers: [AvisService],
  controllers: [AvisController],
  exports: [AvisService],
})
export class AvisModule {}
