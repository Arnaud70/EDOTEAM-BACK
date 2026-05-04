import { Controller, Post, Get, Patch, Body, Param, Request, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';

export class CreateReportDto {
  @ApiProperty({ example: 'Contenu inapproprié' })
  @IsNotEmpty() @IsString()
  motif: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'ID de l\'avis signalé' })
  @IsOptional()
  avisId?: string;

  @ApiProperty({ required: false, description: 'ID du message signalé' })
  @IsOptional()
  messageId?: string;

  @ApiProperty({ required: false, description: 'ID de l\'utilisateur signalé' })
  @IsOptional()
  @IsString()
  targetUserId?: string;
}

@ApiTags('🚩 Signalements')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Signaler un contenu (avis ou message)' })
  @Post()
  create(@Request() req, @Body() dto: CreateReportDto) {
    return this.reportsService.create(req.user.id, dto);
  }

  @ApiOperation({ summary: '[ADMIN] Voir tous les signalements' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get()
  getAll(@Query('status') status?: string) {
    return this.reportsService.getAll(status);
  }

  @ApiOperation({ summary: '[ADMIN] Résoudre un signalement' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/resolve')
  resolve(@Param('id') id: string, @Request() req, @Body('status') status: 'RESOLVED' | 'REJECTED') {
    return this.reportsService.resolve(id, req.user.id, status);
  }
}
