import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { promises as fs } from 'fs';
import { join } from 'path';
import { containsBannedWord, BANNED_WORD_MESSAGE } from '../../common/validation/patterns';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private notificationsService: NotificationsService) {}

  private normalizeMediaUrl(url: string) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const trimmed = url.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    if (trimmed.startsWith('/')) {
      return `${process.env.BACKEND_URL || 'http://localhost:3000'}${trimmed}`;
    }

    return `${process.env.BACKEND_URL || 'http://localhost:3000'}/${trimmed}`;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        services: {
          include: { service: true }
        },
        media: true,
      }
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async updateProfile(userId: string, data: any) {
    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Liste blanche stricte : aucun autre champ (role=ADMIN, verificationStatus,
    // emailVerified, passwordHash, id, email...) ne peut être modifié via cet endpoint.
    const ALLOWED_FIELDS = [
      'prenom', 'nom', 'telephone', 'localisation',
      'latitude', 'longitude', 'titreProfessionnel', 'bio', 'photoUrl', 'genre',
    ] as const;

    const updateData: any = {};
    for (const field of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, field) && data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'photoUrl')) {
      updateData.photoUrl = updateData.photoUrl === '' ? null : this.normalizeMediaUrl(updateData.photoUrl);
    }

    // Filtre de contenu inapproprié sur les champs libres visibles publiquement.
    if (containsBannedWord(updateData.titreProfessionnel) || containsBannedWord(updateData.bio)) {
      throw new BadRequestException(BANNED_WORD_MESSAGE);
    }

    // Basculement de rôle limité à CLIENT <-> PRESTATAIRE. Jamais vers ADMIN.
    if (
      (data.role === 'CLIENT' || data.role === 'PRESTATAIRE') &&
      currentUser.role !== 'ADMIN' &&
      data.role !== currentUser.role
    ) {
      updateData.role = data.role;
      // Un nouveau prestataire doit repasser par la validation admin.
      updateData.verificationStatus = data.role === 'PRESTATAIRE' ? 'PENDING' : 'VERIFIED';
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = updated;
    return result;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Le mot de passe actuel est incorrect');
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien");
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // On révoque toutes les sessions (refresh tokens) existantes après un changement de mot de passe.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true, message: 'Mot de passe mis à jour avec succès.' };
  }

  async getAllPrestataires() {
    return this.prisma.user.findMany({
      where: { role: 'PRESTATAIRE', deletedAt: null, verificationStatus: 'VERIFIED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nom: true,
        prenom: true,
        titreProfessionnel: true,
        localisation: true,
        latitude: true,
        longitude: true,
        photoUrl: true,
        genre: true,
        emailVerified: true,
        verificationStatus: true,
        bio: true,
        services: {
          include: { service: { select: { id: true, nom: true } } },
          take: 5,
        },
        receivedReviews: {
          select: { note: true },
          take: 50,
        },
      },
    });
  }

  async getProviderById(providerId: string) {
    const provider = await this.prisma.user.findUnique({
      where: { id: providerId, role: 'PRESTATAIRE', verificationStatus: 'VERIFIED' },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        titreProfessionnel: true,
        bio: true,
        localisation: true,
        latitude: true,
        longitude: true,
        photoUrl: true,
        genre: true,
        emailVerified: true,
        verificationStatus: true,
        rejectionReason: true,
        createdAt: true,
        services: {
          include: { service: true }
        },
        receivedReviews: {
          select: {
            id: true,
            note: true,
            commentaire: true,
            createdAt: true,
            client: { select: { nom: true, prenom: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        media: { select: { url: true, type: true } },
      },
    });

    if (!provider) {
      throw new NotFoundException('Prestataire non trouvé');
    }

    return provider;
  }

  async addMedia(userId: string, data: { url: string; type: 'PROFILE' | 'WORK' | 'DOCUMENT' }) {
    const normalizedUrl = this.normalizeMediaUrl(data.url);

    if (!normalizedUrl) {
      throw new Error('Une URL de média valide est requise.');
    }

    const media = await this.prisma.media.create({
      data: {
        userId,
        url: normalizedUrl,
        type: data.type,
      },
    });

    if (data.type === 'DOCUMENT') {
      // Un nouveau document remet le compte en attente de vérification par un admin.
      await this.prisma.user.update({
        where: { id: userId },
        data: { verificationStatus: 'PENDING', rejectionReason: null },
      }).catch(() => undefined);

      await this.notificationsService.create({
        userId,
        title: 'Document reçu',
        message: 'Votre document justificatif a bien été reçu. Notre équipe va le vérifier avant de valider votre profil prestataire.',
        type: 'DOCUMENT_RECEIVED',
      }).catch(() => undefined);
    }

    return media;
  }

  async getFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { provider: { include: { services: { include: { service: true } }, receivedReviews: { select: { note: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFavorite(userId: string, providerId: string) {
    if (userId === providerId) throw new Error('Vous ne pouvez pas ajouter votre propre profil aux favoris.');
    return this.prisma.favorite.upsert({
      where: { userId_providerId: { userId, providerId } },
      create: { userId, providerId },
      update: {},
    });
  }

  async removeFavorite(userId: string, providerId: string) {
    return this.prisma.favorite.deleteMany({ where: { userId, providerId } });
  }

  async deleteMedia(userId: string, mediaId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.userId !== userId) {
      throw new NotFoundException('Média introuvable ou non autorisé à supprimer.');
    }

    if (media.url.includes('/uploads/')) {
      try {
        const localPath = media.url.replace(`${process.env.BACKEND_URL || 'http://localhost:3000'}`, '');
        const filePath = join(process.cwd(), 'uploads', localPath.split('/uploads/')[1]);
        await fs.unlink(filePath);
      } catch (error) {
        // Fichier déjà absent: ne pas bloquer la suppression de l'enregistrement
      }
    }

    return this.prisma.media.delete({
      where: {
        id: mediaId,
        userId,
      },
    });
  }
  async searchProviders(query: string, offset: number = 0, latitude?: number, longitude?: number) {
    const limit = 20;
    const searchTerm = query ? query.trim() : '';

    let ids: string[] = [];

    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

    if (searchTerm === '') {
      // Si pas de recherche, on prend juste les derniers prestataires inscrits
      const providers = await this.prisma.user.findMany({
        where: { role: 'PRESTATAIRE', deletedAt: null, verificationStatus: 'VERIFIED' },
        take: hasCoordinates ? 100 : limit,
        skip: offset,
        select: { id: true },
        orderBy: { createdAt: 'desc' }
      });
      ids = providers.map(p => p.id);
    } else {
      // Sinon on utilise le Full-Text Search (SQL Raw)
      const rawResults: any[] = await this.prisma.$queryRaw`
        SELECT u.id
        FROM "User" u
        WHERE u.role = 'PRESTATAIRE'
          AND u.deleted_at IS NULL
          AND u.verification_status = 'VERIFIED'
          AND (
            to_tsvector('french', COALESCE(u.nom, '') || ' ' || COALESCE(u.prenom, '') || ' ' || COALESCE(u.bio, '') || ' ' || COALESCE(u.titre_professionnel, '')) @@ plainto_tsquery('french', ${searchTerm})
            OR EXISTS (
                SELECT 1 FROM "prestataire_services" ps 
                JOIN "Service" s ON s.id = ps.service_id
                WHERE ps.prestataire_id = u.id 
                AND s.nom ILIKE ${'%' + searchTerm + '%'}
            )
          )
        LIMIT ${hasCoordinates ? 100 : limit} OFFSET ${offset}
      `;
      ids = rawResults.map(r => r.id);
    }

    if (ids.length === 0) return [];

    // 2. On récupère les objets complets via Prisma pour avoir les relations (services, avis)
    // et éviter les problèmes de sérialisation BigInt
    const providers = await this.prisma.user.findMany({
      where: {
        id: { in: ids }
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        titreProfessionnel: true,
        bio: true,
        localisation: true,
        latitude: true,
        longitude: true,
        photoUrl: true,
        genre: true,
        emailVerified: true,
        verificationStatus: true,
        services: {
          include: {
            service: true
          }
        },
        receivedReviews: {
          select: {
            note: true
          }
        }
      }
    });

    // 3. Formater pour le frontend (calculer la moyenne des notes)
    const results = providers.map(p => {
      const avgRating = p.receivedReviews.length > 0 
        ? p.receivedReviews.reduce((acc, r) => acc + r.note, 0) / p.receivedReviews.length 
        : 5.0;
      
      return {
        ...p,
        rating: avgRating.toFixed(1),
        nbReviews: p.receivedReviews.length
      };
    });

    if (!hasCoordinates) {
      return results.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    }

    const toRadians = (value: number) => value * Math.PI / 180;
    const distanceInKm = (provider: typeof results[number]) => {
      if (provider.latitude == null || provider.longitude == null) return Number.POSITIVE_INFINITY;
      const deltaLatitude = toRadians(provider.latitude - latitude!);
      const deltaLongitude = toRadians(provider.longitude - longitude!);
      const haversine = Math.sin(deltaLatitude / 2) ** 2
        + Math.cos(toRadians(latitude!)) * Math.cos(toRadians(provider.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    };

    return results
      .map(provider => ({ ...provider, distanceKm: distanceInKm(provider) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  }
}
