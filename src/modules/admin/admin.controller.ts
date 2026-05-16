import { Controller, Get, Patch, Post, Delete, Body, Param, Query, UseGuards, Req, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('🛡️ Administration')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Statistiques de la plateforme' })
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @ApiOperation({ summary: 'Liste de tous les utilisateurs' })
  @Get('users')
  getUsers(@Query('role') role?: string, @Query('status') status?: 'ACTIVE' | 'SUSPENDED') {
    return this.adminService.getAllUsers(role, status);
  }

  @ApiOperation({ summary: 'Logs d\'activité système' })
  @Get('logs')
  getLogs(@Query('limit') limit?: number) {
    return this.adminService.activityLogs(limit);
  }

  @ApiOperation({ summary: 'Liste des signalements' })
  @Get('reports')
  getReports(@Query('status') status?: string) {
    return this.adminService.getAllReports(status);
  }

  @ApiOperation({ summary: 'Résoudre un signalement' })
  @Patch('reports/:id/resolve')
  resolveReport(
    @Param('id') id: string,
    @Body('status') status: 'RESOLVED' | 'REJECTED',
    @Req() req: any,
  ) {
    return this.adminService.resolveReport(id, req.user.id, status);
  }

  @ApiOperation({ summary: 'Suspendre un utilisateur (soft delete)' })
  @Patch('users/:id/suspend')
  suspend(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @ApiOperation({ summary: 'Réactiver un utilisateur' })
  @Patch('users/:id/restore')
  restore(@Param('id') id: string) {
    return this.adminService.restoreUser(id);
  }

  @ApiOperation({ summary: 'Supprimer définitivement un utilisateur' })
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // --- Service Categories ---

  @ApiOperation({ summary: 'Créer une nouvelle catégorie de service' })
  @Post('services')
  createService(@Body() data: { nom: string; description?: string; icon?: string }) {
    return this.adminService.createService(data);
  }

  @ApiOperation({ summary: 'Modifier une catégorie de service' })
  @Patch('services/:id')
  updateService(@Param('id') id: string, @Body() data: { nom?: string; description?: string; icon?: string }) {
    return this.adminService.updateService(id, data);
  }

  @ApiOperation({ summary: 'Supprimer une catégorie de service' })
  @Delete('services/:id')
  deleteService(@Param('id') id: string) {
    return this.adminService.deleteService(id);
  }
}
