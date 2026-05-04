import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private activityLogs: ActivityLogsService,
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
}
