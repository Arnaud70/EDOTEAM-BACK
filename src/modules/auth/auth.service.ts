import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private activityLogs: ActivityLogsService,
    private mailerService: MailerService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const password = dto.motDePasse.trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
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

    const result = await this.getTokens(user.id, user.email, user.role);

    await this.activityLogs.log({
      userId: user.id,
      action: 'REGISTER',
      entityType: 'USER',
      entityId: user.id,
      metadata: { role: user.role },
    });

    // Envoyer l'e-mail de bienvenue personnalisé
    try {
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

    // Envoyer la notification de connexion
    try {
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
    
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Créer l'utilisateur s'il n'existe pas
      user = await this.prisma.user.create({
        data: {
          email,
          nom: nom || 'Utilisateur',
          prenom: prenom || 'Google',
          passwordHash: 'GOOGLE_AUTH_NO_PASSWORD', // Flag pour indiquer qu'il n'y a pas de mot de passe local
          role: 'CLIENT', // Rôle par défaut
        },
      });

      // Envoyer l'e-mail de bienvenue
      try {
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

    return this.getTokens(user.id, user.email, user.role);
  }
}
