import { Injectable, Logger, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { MailerService } from '@nestjs-modules/mailer';
import { NotificationsService } from '../notifications/notifications.service';
import { containsBannedWord, BANNED_WORD_MESSAGE } from '../../common/validation/patterns';
import { AuthTokensService } from './auth-tokens.service';

export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Votre adresse email n'a pas encore été vérifiée. Saisissez le code reçu par email.";

// Hash bcrypt factice ("mot de passe" inconnu) utilisé pour égaliser le temps de réponse
// du login quand l'email n'existe pas -> empêche l'énumération de comptes par timing.
const DUMMY_PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuv0123456789012345678901234567890123';

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

export const isProfileComplete = (user: {
  role?: string;
  telephone?: string | null;
  localisation?: string | null;
  titreProfessionnel?: string | null;
}) => {
  if (!user || user.role === 'ADMIN') {
    return true;
  }

  const hasPhone = !!user.telephone && user.telephone.trim().length > 0;
  const hasLocation = !!user.localisation && user.localisation.trim().length > 0;
  const hasProfessionalTitle = user.role !== 'PRESTATAIRE' || (!!user.titreProfessionnel && user.titreProfessionnel.trim().length > 0);

  return hasPhone && hasLocation && hasProfessionalTitle;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private activityLogs: ActivityLogsService,
    private mailerService: MailerService,
    private notificationsService: NotificationsService,
    private authTokens: AuthTokensService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  private isSmtpConfigured(): boolean {
    return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
  }

  private formatTtl(): string {
    const s = this.authTokens.ttlSeconds;
    if (s % 60 === 0) return `${s / 60} minute${s / 60 > 1 ? 's' : ''}`;
    if (s > 60) return `${Math.floor(s / 60)} min ${s % 60} s`;
    return `${s} secondes`;
  }

  private otpEmailHtml(prenom: string | null, code: string, purpose: 'verification' | 'reset'): string {
    const title = purpose === 'verification'
      ? 'Vérification de votre adresse email'
      : 'Réinitialisation de votre mot de passe';
    const intro = purpose === 'verification'
      ? 'Utilisez le code ci-dessous pour confirmer votre adresse email et activer votre compte EDOTEAM.'
      : 'Utilisez le code ci-dessous pour définir un nouveau mot de passe. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.';
    return `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
        <div style="background-color: #0f172a; padding: 32px 20px; text-align: center;">
          <h1 style="color: #059669; margin: 0; font-size: 22px;">EDOTEAM</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #0f172a; margin-top: 0;">${title}</h2>
          <p style="line-height: 1.6;">Bonjour ${prenom || ''},</p>
          <p style="line-height: 1.6;">${intro}</p>
          <div style="margin: 28px 0; text-align: center;">
            <span style="display: inline-block; font-size: 34px; letter-spacing: 10px; font-weight: 800; color: #0f172a; background: #f1f5f9; padding: 16px 28px; border-radius: 12px;">${code}</span>
          </div>
          <p style="line-height: 1.6; color: #64748b; font-size: 14px;">Ce code expire dans ${this.formatTtl()}.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 18px; text-align: center; font-size: 12px; color: #64748b;">
          © ${new Date().getFullYear()} EDOTEAM
        </div>
      </div>`;
  }

  private async sendOtpEmail(email: string, prenom: string | null, code: string, purpose: 'verification' | 'reset') {
    if (!this.isSmtpConfigured()) {
      this.logger.warn(`SMTP non configuré : code ${purpose} non envoyé par email à ${email}.`);
      return;
    }
    const subject = purpose === 'verification'
      ? 'EDOTEAM - Votre code de vérification'
      : 'EDOTEAM - Votre code de réinitialisation';
    const text = `Votre code EDOTEAM est : ${code}\n\nCe code expire dans ${this.formatTtl()}.\nNe le partagez avec personne.`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        text,
        html: this.otpEmailHtml(prenom, code, purpose),
      });
      this.logger.log(`Code ${purpose} envoyé par email à ${email}.`);
    } catch (error) {
      this.logger.error(
        `Échec d'envoi du code ${purpose} à ${email} : ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
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

    if (containsBannedWord(dto.nom) || containsBannedWord(dto.prenom)) {
      throw new BadRequestException(BANNED_WORD_MESSAGE);
    }

    if (dto.role === 'PRESTATAIRE' && containsBannedWord(dto.specialite)) {
      throw new BadRequestException(BANNED_WORD_MESSAGE);
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
        latitude: dto.latitude,
        longitude: dto.longitude,
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

    // Sans SMTP configuré (dev local), on ne peut pas vérifier l'email : on active le compte directement.
    if (!this.isSmtpConfigured()) {
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      await this.sendWelcomeNotification(user.id, user.role);
      return { ...(await this.getTokens(user.id, user.email, user.role)), emailVerificationRequired: false };
    }

    // Avec SMTP : on envoie un code OTP et on n'ouvre PAS de session tant que l'email n'est pas vérifié.
    try {
      const { code } = await this.authTokens.issueCode(user.id, 'EMAIL_VERIFICATION');
      await this.sendOtpEmail(user.email, user.prenom, code, 'verification');
    } catch (error) {
      console.error("Erreur lors de l'envoi du code de vérification:", error);
    }

    return {
      emailVerificationRequired: true,
      email: user.email,
      otpExpiresIn: this.authTokens.ttlSeconds,
      message: `Un code de vérification a été envoyé à ${user.email}.`,
    };
  }

  private async sendWelcomeNotification(userId: string, role: string) {
    try {
      const welcomeContent = buildWelcomeNotificationContent(role);
      await this.notificationsService.create({
        userId,
        title: welcomeContent.title,
        message: welcomeContent.message,
        type: 'WELCOME',
      });
    } catch (notificationError) {
      console.error('Erreur lors de la création de la notification de bienvenue:', notificationError);
    }
  }

  private async sendWelcomeEmail(user: { email: string; prenom: string | null; role: string }) {
    try {
      if (!this.isSmtpConfigured()) {
        return;
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
  }

  async verifyEmail(email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new BadRequestException('Compte introuvable.');
    }
    if (user.emailVerified) {
      return { ...(await this.getTokens(user.id, user.email, user.role)), alreadyVerified: true };
    }

    await this.authTokens.consumeCode(user.id, 'EMAIL_VERIFICATION', code);

    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    await this.sendWelcomeNotification(user.id, user.role);
    await this.sendWelcomeEmail(user);

    try {
      await this.activityLogs.log({
        userId: user.id,
        action: 'EMAIL_VERIFIED',
        entityType: 'USER',
        entityId: user.id,
      });
    } catch (logError) {
      console.error('Erreur lors de la journalisation de la vérification email:', logError);
    }

    return this.getTokens(user.id, user.email, user.role);
  }

  async resendVerification(email: string) {
    const genericResponse = {
      message: "Si un compte non vérifié correspond à cet email, un nouveau code vient d'être envoyé.",
      otpExpiresIn: this.authTokens.ttlSeconds,
    };
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user && !user.emailVerified && !user.deletedAt) {
      // Si l'utilisateur est verrouillé (trop d'essais), on le lui dit clairement.
      await this.authTokens.assertNotLocked(user.id, 'EMAIL_VERIFICATION');
      try {
        const { code } = await this.authTokens.issueCode(user.id, 'EMAIL_VERIFICATION');
        await this.sendOtpEmail(user.email, user.prenom, code, 'verification');
      } catch (error) {
        console.error("Erreur lors du renvoi du code de vérification:", error);
      }
    }

    return genericResponse;
  }

  async forgotPassword(email: string) {
    const genericResponse = {
      message: 'Si un compte correspond à cet email, un code de réinitialisation vient d’être envoyé.',
      otpExpiresIn: this.authTokens.ttlSeconds,
    };
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user && !user.deletedAt) {
      try {
        const { code } = await this.authTokens.issueCode(user.id, 'PASSWORD_RESET');
        await this.sendOtpEmail(user.email, user.prenom, code, 'reset');
        await this.activityLogs.log({
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'USER',
          entityId: user.id,
        });
      } catch (error) {
        console.error("Erreur lors de l'envoi du code de réinitialisation:", error);
      }
    }

    return genericResponse;
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.deletedAt) {
      throw new BadRequestException('Impossible de réinitialiser le mot de passe.');
    }

    await this.authTokens.consumeCode(user.id, 'PASSWORD_RESET', code);

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien.");
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, passwordHash },
    });

    // Toute session active est révoquée après une réinitialisation de mot de passe.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    try {
      await this.activityLogs.log({
        userId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'USER',
        entityId: user.id,
      });
      if (this.isSmtpConfigured()) {
        await this.mailerService.sendMail({
          to: user.email,
          subject: 'EDOTEAM • Votre mot de passe a été modifié',
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
            <h2 style="color:#059669;">Mot de passe modifié</h2>
            <p>Bonjour ${user.prenom || ''}, votre mot de passe EDOTEAM vient d'être réinitialisé le ${new Date().toLocaleString('fr-FR')}.</p>
            <p>Si vous n'êtes pas à l'origine de cette action, contactez immédiatement le support.</p>
          </div>`,
        });
      }
    } catch (error) {
      console.error('Erreur post-réinitialisation:', error);
    }

    return { success: true, message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const password = dto.motDePasse.trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // On effectue toujours une comparaison bcrypt (même si l'utilisateur n'existe pas)
    // pour ne pas révéler l'existence du compte via le temps de réponse.
    const isMatch = await bcrypt.compare(password, user?.passwordHash || DUMMY_PASSWORD_HASH);

    if (!user || !isMatch) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Ce compte a été suspendu. Contactez le support.');
    }

    if (!user.emailVerified) {
      // Renvoi automatique d'un nouveau code pour faciliter la vérification.
      try {
        const { code } = await this.authTokens.issueCode(user.id, 'EMAIL_VERIFICATION');
        await this.sendOtpEmail(user.email, user.prenom, code, 'verification');
      } catch (error) {
        console.error('Erreur renvoi code à la connexion:', error);
      }
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        otpExpiresIn: this.authTokens.ttlSeconds,
        message: EMAIL_NOT_VERIFIED_MESSAGE,
      });
    }

    const result = await this.getTokens(user.id, user.email, user.role);

    try {
      await this.activityLogs.log({
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
      });
    } catch (logError) {
      console.error('Erreur lors de la journalisation de la connexion:', logError);
    }

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
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
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
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        photoUrl: true,
        genre: true,
        telephone: true,
        localisation: true,
        titreProfessionnel: true,
        verificationStatus: true,
        rejectionReason: true,
        emailVerified: true,
      }
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

    if (user && !user.emailVerified) {
      // La connexion Google prouve la propriété de l'adresse : on la marque vérifiée.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    if (!user) {
      isNewUser = true;
      // Mot de passe aléatoire non communiqué : l'utilisateur Google se connecte via Google.
      // Pour définir un mot de passe classique, il utilisera la page Sécurité (mot de passe actuel = ce random)
      // ou un futur flux "mot de passe oublié".
      const randomPassword = randomBytes(32).toString('base64url');
      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      // Créer l'utilisateur s'il n'existe pas
      user = await this.prisma.user.create({
        data: {
          email,
          nom: nom || 'Utilisateur',
          prenom: prenom || 'Google',
          passwordHash,
          role: 'CLIENT', // Rôle par défaut
          emailVerified: true, // L'adresse est déjà vérifiée par Google
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
          return { ...(await this.getTokens(user.id, user.email, user.role)), isNewUser };
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
    };
  }
}
