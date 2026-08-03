import { Controller, Post, Body, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  async createCheckout(@Req() req, @Body('bookingId') bookingId: string) {
    return this.paymentsService.createCheckoutSession(bookingId, req.user?.id || 'debug-user');
  }

  @Post('webhook')
  async webhook(@Body() body: any) {
    if (body.type === 'checkout.session.completed') {
      return this.paymentsService.handleCheckoutSuccess(body.data.object.id);
    }
    return { received: true };
  }
}
