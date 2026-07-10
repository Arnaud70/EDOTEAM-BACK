import { IsString, IsOptional, IsEnum, IsUrl, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jean' })
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional({ example: 'Dupont' })
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional({ example: '+228 90 00 00 00' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({ example: 'Lomé, Togo' })
  @IsOptional()
  @IsString()
  localisation?: string;

  @ApiPropertyOptional({ example: 'Expert Électricien' })
  @IsOptional()
  @IsString()
  titreProfessionnel?: string;

  @ApiPropertyOptional({ example: 'Spécialisé dans les installations...' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'https://example.com/photo.jpg' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ example: 'MonMotDePasse123', description: 'Nouveau mot de passe (min 6 caractères)' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  motDePasse?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.PRESTATAIRE })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
