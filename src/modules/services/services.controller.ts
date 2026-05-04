import { Controller, Get, Post, Body, Param, UseGuards, Request, Delete, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('🛠️ Services')
@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @UseInterceptors(CacheInterceptor)
  @Get()
  @ApiOperation({ summary: 'List all available service categories' })
  getAll() {
    return this.servicesService.getAll();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get services offered by the authenticated provider' })
  getMyServices(@Request() req: any) {
    return this.servicesService.getProviderServices(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific service category' })
  getOne(@Param('id') id: string) {
    return this.servicesService.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new service category (Admin only usually, but open for now)' })
  create(@Body() data: any) {
    return this.servicesService.create(data);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('me')
  @ApiOperation({ summary: 'Add a service to the provider profile' })
  addMyService(@Request() req: any, @Body() data: { serviceId: string; prixIndicatif?: number; experience?: number }) {
    return this.servicesService.addServiceToProvider(req.user.id, data.serviceId, data.prixIndicatif, data.experience);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('me/:serviceId')
  @ApiOperation({ summary: 'Remove a service from the provider profile' })
  removeMyService(@Request() req: any, @Param('serviceId') serviceId: string) {
    return this.servicesService.removeServiceFromProvider(req.user.id, serviceId);
  }
}
