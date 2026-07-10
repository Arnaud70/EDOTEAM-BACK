import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { MailerService } from '@nestjs-modules/mailer';
import { NotificationsService } from '../notifications/notifications.service';

export const buildWelcomeNotificationContent = (role: string) => {
  const isPrestataire = role === 'PRESTATAIRE';
  const title = isPrestataire
    ? 'Bienvenue Expert EDOTEAM • Votre réussite commence ici'
    : 'Bienvenue sur EDOTEAM • Votre expérience démarre ici';

  const message = isPrestataire
    ? 'Découvrez comment présenter votre expertise, attirer des clients et gérer votre activité avec simplicité. Étapes rapides : 1) Complétez votre profil, 2) Ajoutez vos services, 3) Définissez vos disponibilités, 4) Téléversez vos documents pour renforcer votre crédibilité.'
    : 'Découvrez comment trouver les bons prestataires, réserver en quelques clics et suivre votre expérience avec confiance. Étapes rapides : 1) Complétez votre profil, 2) Explorez les services, 3) Réservez et suivez votre demande.';

  return { title, message };
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private activityLogs: ActivityLogsService,
    private mailerService: MailerService,
    private notificationsService: NotificationsService,
  ) {}

  private isSmtpConfigured(): boolean {
    return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const password = dto.motDePasse.trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    if (dto.role === 'PRESTATAIRE' && dto.specialite) {
      const specialiteStr = dto.specialite.toLowerCase();
      const BANNED_WORDS = ['sexe', 'drogue', 'arme', 'tueur', 'prostituee', 'escort', 'vol', 'arnaque', 'hack', 'piratage', 'drogues', 'armes', 'murder', 'sex', 'porn', 'porno', 'assassin', 'viagra', 'drog'];
      const containsBannedWord = BANNED_WORDS.some(word => specialiteStr.includes(word));
      
      if (containsBannedWord) {
        throw new BadRequestException("Le service proposé est invalide et ne respecte pas nos conditions d'utilisation et nos normes d'excellence.");
      }
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: email,
        passwordHash,
        nom: dto.nom,
        prenom: dto.prenom,
        role: dto.role as any,
        localisation: dto.region,
        titreProfessionnel: dto.specialite,
        telephone: dto.telephone,
      },
    });

    if (dto.role === 'PRESTATAIRE' && dto.specialite) {
      const normalizedName = dto.specialite.trim();
      let service = await this.prisma.service.findFirst({
        where: { nom: { equals: normalizedName, mode: 'insensitive' } },
      });

      if (!service) {
        service = await this.prisma.service.create({
          data: {
            nom: normalizedName,
            description: `Service proposé par ${dto.nom} ${dto.prenom || ''}`.trim(),
          },
        });
      }

      await this.prisma.prestataireService.create({
        data: {
          prestataireId: user.id,
          serviceId: service.id,
          prixIndicatif: null,
          experience: 0,
        },
      }).catch(() => undefined);
    }

    const result = await this.getTokens(user.id, user.email, user.role);

    try {
      await this.activityLogs.log({
        userId: user.id,
        action: 'REGISTER',
        entityType: 'USER',
        entityId: user.id,
        metadata: { role: user.role },
      });
    } catch (logError) {
      console.error("Erreur lors de la journalisation de l'inscription:", logError);
    }

    try {
      const welcomeContent = buildWelcomeNotificationContent(user.role);
      await this.notificationsService.create({
        userId: user.id,
        title: welcomeContent.title,
        message: welcomeContent.message,
        type: 'WELCOME',
      });
    } catch (notificationError) {
      console.error('Erreur lors de la création de la notification de bienvenue:', notificationError);
    }

    // Envoyer l'e-mail de bienvenue personnalisé uniquement si la configuration SMTP est réelle
    try {
      if (!this.isSmtpConfigured()) {
        return result;
      }

      const isPrestataire = user.role === 'PRESTATAIRE';
      const subject = isPrestataire 
        ? 'Bienvenue Expert EDOTEAM - Guide de démarrage' 
        : 'Bienvenue sur EDOTEAM !';

      const emailHtml = isPrestataire ? `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
          <div style="background-color: #064e3b; padding: 40px 20px; text-align: center;">
            <h1 style="color: #fbbf24; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Bienvenue Expert EDOTEAM</h1>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #0f172a;">Félicitations ${user.prenom} !</h2>
            <p style="line-height: 1.6;">Votre compte expert a été créé avec succès. Vous faites maintenant partie de l'élite des prestataires au Togo.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #064e3b; font-size: 16px;">🚀 Vos prochaines étapes :</h3>
              <ul style="padding-left: 20px; line-height: 1.8;">
                <li><strong>Configurez votre profil</strong> : Ajoutez une photo professionnelle et une description captivante dans vos paramètres.</li>
                <li><strong>Ajoutez vos services</strong> : Allez dans "Mes Services" pour définir vos tarifs et spécialités.</li>
                <li><strong>Définissez vos disponibilités</strong> : Indiquez quand vous êtes libre pour recevoir des missions.</li>
                <li><strong>Vérifiez vos documents</strong> : Pour obtenir le badge "Certifié", n'oubliez pas de soumettre vos pièces justificatives.</li>
              </ul>
            </div>
            
            <p style="line-height: 1.6;">Besoin d'aide ? Notre support dédié aux experts est disponible 24h/24 via votre tableau de bord.</p>
            
            <div style="text-align: center; margin-top: 35px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accéder à mon Tableau de Bord</a>
            </div>
          </div>
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
            © ${new Date().getFullYear()} EDOTEAM - L'Excellence à votre service.
          </div>
        </div>
      ` : `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
          <div style="background-color: #0f172a; padding: 40px 20px; text-align: center;">
            <h1 style="color: #059669; margin: 0; font-size: 24px;">Bienvenue sur EDOTEAM</h1>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #0f172a;">Bonjour ${user.prenom},</h2>
            <p style="line-height: 1.6;">Merci d'avoir rejoint le cercle privé EDOTEAM. Vous avez désormais accès aux meilleurs talents et experts certifiés du pays.</p>
            
            <p style="line-height: 1.6;"><strong>Ce que vous pouvez faire dès maintenant :</strong></p>
            <ul style="line-height: 1.8;">
              <li>Rechercher des experts par métier ou par ville.</li>
              <li>Consulter les avis et les réalisations des prestataires.</li>
              <li>Réserver un service en quelques clics.</li>
            </ul>
            
            <div style="text-align: center; margin-top: 35px;">
              <a href="${process.env.FRONTEND_URL}" style="background-color: #0f172a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Découvrir les experts</a>
            </div>
          </div>
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
            © ${new Date().getFullYear()} EDOTEAM - L'Excellence à votre service.
          </div>
        </div>
      `;

      await this.mailerService.sendMail({
        to: user.email,
        subject: subject,
        html: emailHtml,
      });
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'e-mail de bienvenue personnalisé:", error);
    }

    return result;
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const password = dto.motDePasse.trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const result = await this.getTokens(user.id, user.email, user.role);

    await this.activityLogs.log({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
    });

    try {
      await this.notificationsService.create({
        userId: user.id,
        title: 'Bienvenue sur EDOTEAM',
        message: 'Vous êtes connecté avec succès. Consultez rapidement vos notifications pour découvrir les nouveautés et configurer votre profil selon votre rôle.',
        type: 'LOGIN',
      });
    } catch (notificationError) {
      console.error('Erreur lors de la création de la notification de connexion:', notificationError);
    }

    // Envoyer la notification de connexion par e-mail si la configuration mail est disponible
    try {
      if (this.isSmtpConfigured()) {
        await this.mailerService.sendMail({
          to: user.email,
          subject: 'Nouvelle connexion à votre compte EDOTEAM',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
              <h2 style="color: #2196F3;">Alerte de connexion</h2>
              <p>Bonjour ${user.prenom},</p>
              <p>Une nouvelle connexion a été détectée sur votre compte le ${new Date().toLocaleString('fr-FR')}.</p>
              <p>Si c'était vous, vous pouvez ignorer cet e-mail. Sinon, veuillez sécuriser votre compte immédiatement.</p>
              <br>
              <p>Cordialement,<br>L'équipe EDOTEAM</p>
            </div>
          `,
        });
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'e-mail de connexion:", error);
    }

    return result;
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.activityLogs.log({
      userId,
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: userId,
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        media: true,
      },
    });
    if (!user) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async refreshTokens(userId: string, rt: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new ForbiddenException('Accès refusé');

    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
    });

    const validToken = tokens.find(t => bcrypt.compareSync(rt, t.tokenHash));
    if (!validToken) throw new ForbiddenException('Accès refusé');

    // Rotation: on révoque l'ancien
    await this.prisma.refreshToken.update({
      where: { id: validToken.id },
      data: { revokedAt: new Date() },
    });

    return this.getTokens(user.id, user.email, user.role);
  }

  private async getTokens(userId: string, email: string, role: string) {
    const jwtPayload = { sub: userId, email, role };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.JWT_SECRET || 'super_secret_luxe_togo',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.JWT_REFRESH_SECRET || 'super_refresh_secret_togo',
        expiresIn: '7d',
      }),
    ]);

    const salt = await bcrypt.genSalt();
    const rtHash = await bcrypt.hash(rt, salt);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: rtHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nom: true, prenom: true, role: true, photoUrl: true }
    });

    return {
      access_token: at,
      refresh_token: rt,
      user,
    };
  }

  async validateGoogleUser(googleUser: any) {
    const { email, nom, prenom } = googleUser;
    let isNewUser = false;

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    let temporaryPassword: string | undefined;
    if (!user) {
      isNewUser = true;
      temporaryPassword = randomBytes(12).toString('base64url').slice(0, 12);
      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(temporaryPassword, salt);

      // Créer l'utilisateur s'il n'existe pas
      user = await this.prisma.user.create({
        data: {
          email,
          nom: nom || 'Utilisateur',
          prenom: prenom || 'Google',
          passwordHash,
          role: 'CLIENT', // Rôle par défaut
        },
      });

      try {
        const welcomeContent = buildWelcomeNotificationContent(user.role);
        await this.notificationsService.create({
          userId: user.id,
          title: welcomeContent.title,
          message: welcomeContent.message,
          type: 'WELCOME',
        });
      } catch (notificationError) {
        console.error('Erreur lors de la création de la notification de bienvenue Google:', notificationError);
      }

      // Envoyer l'e-mail de bienvenue uniquement si la configuration SMTP est réelle
      try {
        if (!this.isSmtpConfigured()) {
          return { ...(await this.getTokens(user.id, user.email, user.role)), isNewUser, temporaryPassword };
        }

        await this.mailerService.sendMail({
          to: user.email,
          subject: 'Bienvenue sur EDOTEAM (via Google) !',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px;">
              <h2 style="color: #4CAF50;">Bienvenue sur EDOTEAM, ${user.prenom} !</h2>
              <p>Votre compte a été créé avec succès via votre compte Google.</p>
              <br>
              <p>Cordialement,<br>L'équipe EDOTEAM</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Erreur lors de l'envoi de l'e-mail de bienvenue Google:", error);
      }
    }

    return {
      ...(await this.getTokens(user.id, user.email, user.role)),
      isNewUser,
      temporaryPassword: isNewUser ? temporaryPassword : undefined,
    };
  }
}
