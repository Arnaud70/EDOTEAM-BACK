import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  getWallet(@Request() req) {
    return this.walletService.getOrCreateWallet(req.user.id);
  }

  @Post('deposit')
  deposit(@Request() req, @Body('amount') amount: number) {
    return this.walletService.addTransaction(req.user.id, {
      type: 'DEPOSIT',
      amount,
      description: 'Dépôt via mobile money',
    });
  }
}
