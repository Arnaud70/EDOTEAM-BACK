import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId, balance: 0 },
        include: { transactions: true },
      });
    }

    return wallet;
  }

  async addTransaction(userId: string, data: {
    type: TransactionType;
    amount: number;
    description?: string;
  }) {
    const wallet = await this.getOrCreateWallet(userId);
    
    // Update balance
    const newBalance = data.type === TransactionType.DEPOSIT || data.type === TransactionType.REFUND
      ? Number(wallet.balance) + data.amount
      : Number(wallet.balance) - data.amount;

    return this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: data.type,
          amount: data.amount,
          description: data.description,
          status: 'COMPLETED',
        },
      }),
    ]);
  }
}
