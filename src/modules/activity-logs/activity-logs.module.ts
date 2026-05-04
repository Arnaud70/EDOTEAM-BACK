import { Module, Global } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';

@Global()
@Module({
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
