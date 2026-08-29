import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NAME_REGEX,
  NAME_REGEX_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
  PHONE_REGEX,
  PHONE_REGEX_MESSAGE,
  trimTransform,
} from '../../../common/validation/patterns';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email de l\'utilisateur' })
  @Transform(trimTransform)
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;

  @ApiProperty({ example: 'MonMotDePasse1!', description: 'Mot de passe robuste (min 8 caractères, majuscule, minuscule, chiffre, caractère spécial)' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères` })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  motDePasse: string;

  @ApiProperty({ example: 'Kouassi', description: 'Nom de famille (lettres uniquement)' })
  @Transform(trimTransform)
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @MaxLength(50, { message: 'Le nom ne doit pas dépasser 50 caractères' })
  @Matches(NAME_REGEX, { message: `Le nom : ${NAME_REGEX_MESSAGE}` })
  nom: string;

  @ApiPropertyOptional({ example: 'Kwame', description: 'Prénom (lettres uniquement)' })
  @Transform(trimTransform)
  @IsOptional()
  @ValidateIf((o) => o.prenom !== undefined && o.prenom !== '')
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le prénom doit contenir au moins 2 caractères' })
  @MaxLength(50, { message: 'Le prénom ne doit pas dépasser 50 caractères' })
  @Matches(NAME_REGEX, { message: `Le prénom : ${NAME_REGEX_MESSAGE}` })
  prenom?: string;

  @ApiProperty({ example: '+228 90 00 00 00', description: 'Numéro de téléphone (obligatoire à l\'inscription)' })
  @Transform(trimTransform)
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire' })
  @IsString({ message: 'Le numéro de téléphone doit être une chaîne de caractères' })
  @Matches(PHONE_REGEX, { message: PHONE_REGEX_MESSAGE })
  telephone: string;

  @ApiProperty({ example: 'CLIENT', enum: ['CLIENT', 'PRESTATAIRE'], description: 'Rôle de l\'utilisateur' })
  @IsIn(['CLIENT', 'PRESTATAIRE'], { message: 'Le rôle doit être CLIENT ou PRESTATAIRE' })
  role: 'CLIENT' | 'PRESTATAIRE';

  @ApiProperty({ example: 'Lomé', description: 'Localisation / région' })
  @Transform(trimTransform)
  @IsString({ message: 'La région doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La région est obligatoire' })
  @MaxLength(120, { message: 'La région ne doit pas dépasser 120 caractères' })
  region: string;

  @ApiPropertyOptional({ example: 'Plombier', description: 'Titre professionnel du prestataire' })
  @Transform(trimTransform)
  @ValidateIf((o) => o.role === 'PRESTATAIRE')
  @IsNotEmpty({ message: 'La spécialité est obligatoire pour les prestataires' })
  @IsString({ message: 'La spécialité doit être une chaîne de caractères' })
  @MaxLength(120, { message: 'La spécialité ne doit pas dépasser 120 caractères' })
  specialite?: string;

  @ApiPropertyOptional({ example: 6.1725 })
  @IsOptional() @IsNumber({}, { message: 'La latitude doit être un nombre' })
  latitude?: number;

  @ApiPropertyOptional({ example: 1.2314 })
  @IsOptional() @IsNumber({}, { message: 'La longitude doit être un nombre' })
  longitude?: number;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(trimTransform)
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(trimTransform)
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(trimTransform)
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Code à 6 chiffres reçu par email' })
  @Transform(trimTransform)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code doit contenir 6 chiffres' })
  code: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(trimTransform)
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Code à 6 chiffres reçu par email' })
  @Transform(trimTransform)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code doit contenir 6 chiffres' })
  code: string;

  @ApiProperty({ example: 'MonNouveauMdp1!', description: 'Nouveau mot de passe robuste' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères` })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  motDePasse: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(trimTransform)
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;

  @ApiProperty({ example: 'MonMotDePasse1!' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  motDePasse: string;
}
