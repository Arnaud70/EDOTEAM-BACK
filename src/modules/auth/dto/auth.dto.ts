import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email de l\'utilisateur' })
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123', description: 'Mot de passe (min 6 caractères)' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  motDePasse: string;

  @ApiProperty({ example: 'Kouassi', description: 'Nom de famille' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  nom: string;

  @ApiPropertyOptional({ example: 'Kwame', description: 'Prénom' })
  @IsOptional()
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  prenom?: string;

  @ApiPropertyOptional({ example: '+228 90 00 00 00', description: 'Numéro de téléphone' })
  @IsOptional()
  @IsString({ message: 'Le numéro de téléphone doit être une chaîne de caractères' })
  telephone?: string;

  @ApiProperty({ example: 'CLIENT', enum: ['CLIENT', 'PRESTATAIRE'], description: 'Rôle de l\'utilisateur' })
  @IsString({ message: 'Le rôle doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le rôle est obligatoire' })
  role: 'CLIENT' | 'PRESTATAIRE';

  @ApiPropertyOptional({ example: 'Lomé', description: 'Localisation du prestataire' })
  @IsString({ message: 'La région doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La région est obligatoire' })
  region?: string;

  @ApiPropertyOptional({ example: 'Plombier', description: 'Titre professionnel du prestataire' })
  @ValidateIf(o => o.role === 'PRESTATAIRE')
  @IsNotEmpty({ message: 'La spécialité est obligatoire pour les prestataires' })
  @IsString({ message: 'La spécialité doit être une chaîne de caractères' })
  specialite?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  motDePasse: string;
}

