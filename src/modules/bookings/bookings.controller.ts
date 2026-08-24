import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BookingStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  create(@Request() req, @Body() dto: any) {
    return this.bookingsService.create({
      ...dto,
      clientId: req.user.id,
      date: new Date(dto.date),
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      interventionLatitude: dto.interventionLatitude == null ? undefined : Number(dto.interventionLatitude),
      interventionLongitude: dto.interventionLongitude == null ? undefined : Number(dto.interventionLongitude),
    });
  }

  @Get('provider/:prestataireId')
  getBusySlots(@Param('prestataireId') prestataireId: string, @Query('date') date?: string) {
    return this.bookingsService.getBusySlots(prestataireId, date);
  }

  @Get()
  findAll(@Request() req) {
    return this.bookingsService.findAll(req.user.id, req.user.role);
  }

  @Patch(':id/status')
  updateStatus(@Request() req, @Param('id') id: string, @Body('status') status: BookingStatus) {
    return this.bookingsService.updateStatus(id, status, req.user.id);
  }
}
