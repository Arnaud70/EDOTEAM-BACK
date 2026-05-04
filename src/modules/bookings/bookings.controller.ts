import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
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
    });
  }

  @Get()
  findAll(@Request() req) {
    return this.bookingsService.findAll(req.user.id, req.user.role);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: BookingStatus) {
    return this.bookingsService.updateStatus(id, status);
  }
}
