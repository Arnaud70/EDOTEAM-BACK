import { Controller, Post, Body, HttpCode, HttpStatus, Res, UseGuards, Req, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('🔐 Authentification')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Créer un nouveau compte utilisateur' })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: any
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshToken(res, result.refresh_token);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refresh_token, ...rest } = result;
    return rest;
  }

  @ApiOperation({ summary: 'Se connecter et obtenir un token JWT' })
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
    const rt = req.cookies['refresh_token'];
    if (!rt) return { message: 'Refresh token manquant' };
    
    // Pour extraire le userId, on décode le token (normalement on utiliserait une stratégie JWT Refresh)
    // Ici on simplifie pour l'exemple
    const payload: any = await this.authService['jwtService'].decode(rt);
    if (!payload) return { message: 'Refresh token invalide' };

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
    
    // On redirige vers le frontend avec le access_token (ou on peut utiliser un message postMessage)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/?token=${result.access_token}`);
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

