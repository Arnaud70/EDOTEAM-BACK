import { Controller, Get, UseGuards, Request, Patch, Body, Param, Post, Delete, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';


@ApiTags(' Utilisateurs')
@Controller('users')

export class UsersController {
  constructor(private usersService: UsersService) { }

  @Get('search')
  @ApiOperation({ summary: 'Recherche avancée de prestataires (CDC v4.0)' })
  @ApiQuery({ name: 'q', required: false, description: 'Terme de recherche' })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset' })
  search(@Query('q') q: string, @Query('offset') offset: string) {
    return this.usersService.searchProviders(q, parseInt(offset) || 0);
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

  @UseInterceptors(CacheInterceptor)
  @Get('prestataires')
  getAllPrestataires() {
    return this.usersService.getAllPrestataires();
  }

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
