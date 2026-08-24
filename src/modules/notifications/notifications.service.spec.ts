import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('skips creating a notification when the user does not exist', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      notification: {
        create: jest.fn(),
      },
    } as any;

    const mailerService = {
      sendMail: jest.fn(),
    } as any;

    const service = new NotificationsService(prisma, mailerService);

    const result = await service.create({
      userId: 'missing-user',
      title: 'Test',
      message: 'Test message',
      type: 'TEST',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-user' },
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
