import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from '../../../common/validation/patterns';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  oldPassword: string;

  @ApiProperty({ description: 'Nouveau mot de passe robuste' })
  @IsString()
  @IsNotEmpty({ message: 'Le nouveau mot de passe est obligatoire' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères` })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  newPassword: string;
}
