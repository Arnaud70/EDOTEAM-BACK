import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  prestataireId: string;

  @IsUUID()
  serviceId: string;

  @IsDateString()
  date: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  interventionLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  interventionLongitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clientNote?: string;
}
