import { Controller, Post, Body, HttpCode, HttpStatus, Res, UseGuards, Req, Get, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('🔐 Authentification')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Créer un nouveau compte utilisateur' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: any
  ) {
    const result: any = await this.authService.register(dto);
    if (result.refresh_token) {
      this.setRefreshToken(res, result.refresh_token);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refresh_token, ...rest } = result;
    return rest;
  }

  @ApiOperation({ summary: 'Vérifier son adresse email avec le code OTP reçu' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result: any = await this.authService.verifyEmail(dto.email, dto.code);
    if (result.refresh_token) {
      this.setRefreshToken(res, result.refresh_token);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refresh_token, ...rest } = result;
    return rest;
  }

  @ApiOperation({ summary: 'Renvoyer un code de vérification email' })
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @ApiOperation({ summary: 'Demander un code de réinitialisation de mot de passe' })
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiOperation({ summary: 'Réinitialiser son mot de passe avec le code OTP reçu' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.motDePasse);
  }

  @ApiOperation({ summary: 'Se connecter et obtenir un token JWT' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: any
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshToken(res, result.refresh_token);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refresh_token, ...rest } = result;
    return rest;
  }

  @ApiOperation({ summary: 'Rafraîchir les tokens' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any
  ) {
    const rt = req.cookies?.['refresh_token'];
    if (!rt) throw new UnauthorizedException('Refresh token manquant');

    // On vérifie la SIGNATURE et l'expiration du refresh token (pas un simple decode).
    let payload: any;
    try {
      payload = await this.authService['jwtService'].verifyAsync(rt, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const result = await this.authService.refreshTokens(payload.sub, rt);
    this.setRefreshToken(res, result.refresh_token);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refresh_token, ...rest } = result;
    return rest;
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Se déconnecter' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: any
  ) {
    await this.authService.logout(req.user.id);
    res.clearCookie('refresh_token');
    return { success: true };
  }

  @ApiOperation({ summary: 'Initier la connexion Google' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async googleAuth(@Req() req: any) {}

  @ApiOperation({ summary: 'Callback après connexion Google' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    const result = await this.authService.validateGoogleUser(req.user);

    // On met le refresh token dans le cookie
    this.setRefreshToken(res, result.refresh_token);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const onboardingParam = result.isNewUser ? '&onboarding=1' : '';
    res.redirect(`${frontendUrl}/?token=${result.access_token}${onboardingParam}`);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer le profil utilisateur actuel' })
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  private setRefreshToken(res: any, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });
  }
}

