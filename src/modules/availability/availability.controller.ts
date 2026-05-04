import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AvailabilityService } from './availability.service';

@ApiTags('📅 Disponibilités')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('availability')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @ApiOperation({ summary: 'Définir mes disponibilités (prestataire)' })
  @Post()
  set(@Request() req, @Body() slots: any[]) {
    return this.availabilityService.setAvailability(req.user.id, slots);
  }

  @ApiOperation({ summary: 'Voir mes propres disponibilités (prestataire)' })
  @Get('me')
  getMy(@Request() req: any) {
    return this.availabilityService.getAvailability(req.user.id);
  }

  @ApiOperation({ summary: 'Voir les disponibilités d\'un prestataire' })
  @Get(':prestataireId')
  get(@Param('prestataireId') prestataireId: string) {
    return this.availabilityService.getAvailability(prestataireId);
  }
}
