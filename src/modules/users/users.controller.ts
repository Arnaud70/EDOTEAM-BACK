import { Controller, Get, UseGuards, Request, Patch, Body, Param, Post, Delete, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';


@ApiTags(' Utilisateurs')
@Controller('users')

export class UsersController {
  constructor(private usersService: UsersService) { }

  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120_000)
  @Get('search')
  @ApiOperation({ summary: 'Recherche avancée de prestataires (CDC v4.0)' })
  @ApiQuery({ name: 'q', required: false, description: 'Terme de recherche' })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset' })
  search(@Query('q') q: string, @Query('offset') offset: string, @Query('latitude') latitude: string, @Query('longitude') longitude: string) {
    return this.usersService.searchProviders(q, parseInt(offset) || 0, Number(latitude), Number(longitude));
  }

  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  getFavorites(@Request() req: any) {
    return this.usersService.getFavorites(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('favorites/:providerId')
  addFavorite(@Request() req: any, @Param('providerId') providerId: string) {
    return this.usersService.addFavorite(req.user.id, providerId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('favorites/:providerId')
  removeFavorite(@Request() req: any, @Param('providerId') providerId: string) {
    return this.usersService.removeFavorite(req.user.id, providerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiOperation({ summary: 'Mettre à jour le profil de l\'utilisateur connecté' })
  updateProfile(@Request() req, @Body() data: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  @ApiOperation({ summary: 'Changer son mot de passe (mot de passe actuel requis)' })
  changePassword(@Request() req, @Body() data: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.id, data.oldPassword, data.newPassword);
  }

  @UseInterceptors(CacheInterceptor)
  @Get('prestataires')
  getAllPrestataires() {
    return this.usersService.getAllPrestataires();
  }

  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120_000)
  @Get('providers/:id')
  getProvider(@Param('id') id: string) {
    return this.usersService.getProviderById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('media')
  @ApiOperation({ summary: 'Ajouter un média au portfolio ou profil' })
  addMedia(@Request() req, @Body() data: { url: string; type: 'PROFILE' | 'WORK' | 'DOCUMENT' }) {
    return this.usersService.addMedia(req.user.id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('media/:id')
  @ApiOperation({ summary: 'Supprimer un média' })
  deleteMedia(@Request() req, @Param('id') id: string) {
    return this.usersService.deleteMedia(req.user.id, id);
  }
}
