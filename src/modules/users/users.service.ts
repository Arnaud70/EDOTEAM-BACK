import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
    const updateData: any = { ...data };
    if (updateData.motDePasse) {
      const salt = await bcrypt.genSalt();
      updateData.passwordHash = await bcrypt.hash(updateData.motDePasse, salt);
      delete updateData.motDePasse;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async getAllPrestataires() {
    return this.prisma.user.findMany({
      where: { role: 'PRESTATAIRE', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nom: true,
        prenom: true,
        titreProfessionnel: true,
        localisation: true,
        photoUrl: true,
        emailVerified: true,
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
      where: { id: providerId, role: 'PRESTATAIRE' },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        titreProfessionnel: true,
        bio: true,
        localisation: true,
        photoUrl: true,
        emailVerified: true,
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
    return this.prisma.media.create({
      data: {
        userId,
        url: data.url,
        type: data.type,
      },
    });
  }

  async deleteMedia(userId: string, mediaId: string) {
    return this.prisma.media.delete({
      where: {
        id: mediaId,
        userId, // Sécurité: on ne peut supprimer que ses propres médias
      },
    });
  }
  async searchProviders(query: string, offset: number = 0) {
    const limit = 20;
    const searchTerm = query ? query.trim() : '';

    let ids: string[] = [];

    if (searchTerm === '') {
      // Si pas de recherche, on prend juste les derniers prestataires inscrits
      const providers = await this.prisma.user.findMany({
        where: { role: 'PRESTATAIRE', deletedAt: null },
        take: limit,
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
          AND (
            to_tsvector('french', COALESCE(u.nom, '') || ' ' || COALESCE(u.prenom, '') || ' ' || COALESCE(u.bio, '') || ' ' || COALESCE(u.titre_professionnel, '')) @@ plainto_tsquery('french', ${searchTerm})
            OR EXISTS (
                SELECT 1 FROM "prestataire_services" ps 
                JOIN "Service" s ON s.id = ps.service_id
                WHERE ps.prestataire_id = u.id 
                AND s.nom ILIKE ${'%' + searchTerm + '%'}
            )
          )
        LIMIT ${limit} OFFSET ${offset}
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
      include: {
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
    return providers.map(p => {
      const avgRating = p.receivedReviews.length > 0 
        ? p.receivedReviews.reduce((acc, r) => acc + r.note, 0) / p.receivedReviews.length 
        : 5.0;
      
      return {
        ...p,
        rating: avgRating.toFixed(1),
        nbReviews: p.receivedReviews.length
      };
    }).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); // Garder l'ordre du ranking SQL
  }
}
