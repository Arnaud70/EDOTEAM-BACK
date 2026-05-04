import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { StatsController } from './stats.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../reports/reports.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [PrismaModule, UsersModule, ReportsModule, ActivityLogsModule],
  providers: [AdminService],
  controllers: [AdminController, StatsController],
  exports: [AdminService],
})
export class AdminModule {}
