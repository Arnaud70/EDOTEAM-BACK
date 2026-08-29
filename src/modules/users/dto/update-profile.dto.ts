import {
  IsString,
  IsOptional,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  NAME_REGEX,
  NAME_REGEX_MESSAGE,
  PHONE_REGEX,
  PHONE_REGEX_MESSAGE,
  trimTransform,
} from '../../../common/validation/patterns';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jean' })
  @Transform(trimTransform)
  @IsOptional()
  @ValidateIf((o) => o.prenom !== undefined && o.prenom !== '')
  @IsString()
  @MinLength(2, { message: 'Le prénom doit contenir au moins 2 caractères' })
  @MaxLength(50, { message: 'Le prénom ne doit pas dépasser 50 caractères' })
  @Matches(NAME_REGEX, { message: `Le prénom : ${NAME_REGEX_MESSAGE}` })
  prenom?: string;

  @ApiPropertyOptional({ example: 'Dupont' })
  @Transform(trimTransform)
  @IsOptional()
  @ValidateIf((o) => o.nom !== undefined && o.nom !== '')
  @IsString()
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @MaxLength(50, { message: 'Le nom ne doit pas dépasser 50 caractères' })
  @Matches(NAME_REGEX, { message: `Le nom : ${NAME_REGEX_MESSAGE}` })
  nom?: string;

  @ApiPropertyOptional({ example: '+228 90 00 00 00' })
  @Transform(trimTransform)
  @IsOptional()
  @ValidateIf((o) => o.telephone !== undefined && o.telephone !== '')
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  telephone?: string;

  @ApiPropertyOptional({ example: 'Lomé, Togo' })
  @Transform(trimTransform)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  localisation?: string;

  @ApiPropertyOptional({ example: 6.1725 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 1.2314 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'Expert Électricien' })
  @Transform(trimTransform)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titreProfessionnel?: string;

  @ApiPropertyOptional({ example: 'Spécialisé dans les installations...' })
  @Transform(trimTransform)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://example.com/photo.jpg' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ enum: ['HOMME', 'FEMME'], example: 'HOMME', description: 'Utilisé pour l\'icône de profil par défaut quand aucune photo n\'est définie.' })
  @IsOptional()
  @IsIn(['HOMME', 'FEMME'], { message: 'Le genre doit être HOMME ou FEMME' })
  genre?: 'HOMME' | 'FEMME';

  /**
   * Seul le basculement CLIENT <-> PRESTATAIRE est autorisé ici.
   * L'attribution du rôle ADMIN passe exclusivement par la base / un administrateur.
   */
  @ApiPropertyOptional({ enum: ['CLIENT', 'PRESTATAIRE'], example: 'PRESTATAIRE' })
  @IsOptional()
  @IsIn(['CLIENT', 'PRESTATAIRE'], { message: 'Le rôle doit être CLIENT ou PRESTATAIRE' })
  role?: 'CLIENT' | 'PRESTATAIRE';
}
