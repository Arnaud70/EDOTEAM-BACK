import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('📊 Statistiques')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stats')
export class StatsController {
  constructor(private adminService: AdminService) {}

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Platfom global stats (Admin only)' })
  getAdminStats() {
    return this.adminService.getStats();
  }

  @Get('provider')
  @Roles('PRESTATAIRE')
  @ApiOperation({ summary: 'Provider specific stats' })
  getProviderStats(@Request() req: any) {
    return this.adminService.getProviderStats(req.user.id);
  }
}
