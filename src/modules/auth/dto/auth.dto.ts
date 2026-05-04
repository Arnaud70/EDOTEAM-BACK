import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email de l\'utilisateur' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123', description: 'Mot de passe (min 6 caractères)' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  motDePasse: string;

  @ApiProperty({ example: 'Kouassi', description: 'Nom de famille' })
  @IsNotEmpty()
  @IsString()
  nom: string;

  @ApiPropertyOptional({ example: 'Kwame', description: 'Prénom' })
  @IsString()
  prenom?: string;

  @ApiProperty({ example: 'CLIENT', enum: ['CLIENT', 'PRESTATAIRE'], description: 'Rôle de l\'utilisateur' })
  @IsString()
  @IsNotEmpty()
  role: 'CLIENT' | 'PRESTATAIRE';
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MonMotDePasse123' })
  @IsNotEmpty()
  @IsString()
  motDePasse: string;
}

