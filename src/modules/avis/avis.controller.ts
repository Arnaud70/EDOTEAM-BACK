import { Controller, Post, Get, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AvisService } from './avis.service';

export class CreateAvisDto {
  @ApiProperty({ example: 'uuid-du-prestataire' })
  @IsString()
  @IsNotEmpty()
  prestataireId: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt() @Min(1) @Max(5)
  note: number;

  @ApiProperty({ example: 'Excellent travail !', required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

@ApiTags('⭐ Avis')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('avis')
export class AvisController {
  constructor(private avisService: AvisService) {}

  @ApiOperation({ summary: 'Laisser un avis pour un prestataire (interaction requise)' })
  @Post()
  create(@Request() req, @Body() dto: CreateAvisDto) {
    return this.avisService.create(req.user.id, dto.prestataireId, dto.note, dto.commentaire);
  }

  @ApiOperation({ summary: 'Voir les avis d\'un prestataire' })
  @Get('prestataire/:prestataireId')
  getForPrestataire(@Param('prestataireId') prestataireId: string) {
    return this.avisService.getForPrestataire(prestataireId);
  }

  @ApiOperation({ summary: 'Modifier mon avis (délai: 7 jours)' })
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: Partial<CreateAvisDto>) {
    return this.avisService.update(id, req.user.id, dto.note!, dto.commentaire);
  }
}
