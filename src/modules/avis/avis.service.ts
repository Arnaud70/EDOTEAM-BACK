import { Injectable, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AvisService {
  constructor(
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private notificationsService: NotificationsService,
  ) {}

  async create(clientId: string, prestataireId: string, note: number, commentaire?: string) {
    if (clientId === prestataireId) {
      throw new BadRequestException('Vous ne pouvez pas vous noter vous-même');
    }
    if (note < 1 || note > 5) {
      throw new BadRequestException('La note doit être entre 1 et 5');
    }

    // Vérification interaction préalable
    const hasInteracted = await this.messagesService.hasInteracted(clientId, prestataireId);
    
    // Au lieu de bloquer l'avis, on flagge simplement s'il y a eu interaction.
    // Cela permet aux utilisateurs de laisser un avis même s'ils ont interagi hors plateforme.
    const interactionVerified = hasInteracted;

    // 1 seul avis par client/prestataire
    const existing = await this.prisma.avis.findUnique({
      where: { clientId_prestataireId: { clientId, prestataireId } },
    });
    if (existing) {
      throw new ConflictException('Vous avez déjà laissé un avis pour ce prestataire');
    }

    const avis = await this.prisma.avis.create({
      data: { clientId, prestataireId, note, commentaire, interactionVerified },
      include: {
        client: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
      },
    });

    // Notify the provider
    await this.notificationsService.create({
      userId: prestataireId,
      title: 'Nouvel avis reçu',
      message: `${avis.client.prenom} ${avis.client.nom} vous a laissé un avis de ${note}/5.`,
      type: 'AVIS_RECEIVED',
    });

    return avis;
  }

  async getForPrestataire(prestataireId: string) {
    const avis = await this.prisma.avis.findMany({
      where: { prestataireId },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
      },
    });

    const avg = avis.length > 0 ? avis.reduce((acc, a) => acc + a.note, 0) / avis.length : 0;

    return {
      noteMoyenne: Math.round(avg * 10) / 10,
      total: avis.length,
      avis,
    };
  }

  async update(avisId: string, clientId: string, note: number, commentaire?: string) {
    const avis = await this.prisma.avis.findUnique({ where: { id: avisId } });
    if (!avis || avis.clientId !== clientId) {
      throw new ForbiddenException('Avis non trouvé ou non autorisé');
    }

    // Modifiable pendant 7 jours
    const diff = Date.now() - avis.createdAt.getTime();
    if (diff > 7 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Vous ne pouvez plus modifier cet avis (délai de 7 jours dépassé)');
    }

    return this.prisma.avis.update({
      where: { id: avisId },
      data: { note, commentaire },
    });
  }
}
